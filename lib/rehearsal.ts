import "server-only";

import { mirrorFallback, styleProfile } from "@/lib/engine";
import { buildFeedback } from "@/lib/feedback";
import { applyLabel, newProgress } from "@/lib/game";
import { labelTurn } from "@/lib/judge";
import { getClient, modelName } from "@/lib/openai";
import { characterSystem, mirrorSystem, sanitizeLine } from "@/lib/prompts";
import { getScene } from "@/lib/scenes";
import { getScript, scriptedLine } from "@/lib/scripts";
import { HttpError } from "@/lib/schemas";
import { asThread, createThread as persistThread, getThread, listThreads, saveThread } from "@/lib/store";
import type { Message, Thread, Voice } from "@/lib/types";

/*
 * One scenario run:
 *   talk   → each user line is labeled (criteria met / strike / neutral), the
 *            hidden progress updates, and the friend replies in character.
 *            Ends automatically on resolution or strike 4.
 *   review → the role-reversal feedback (required, generated on first view).
 *   mirror → optional: the user answers as the friend while the model replays
 *            the user's own lines back at them.
 */

function now() {
  return new Date().toISOString();
}

function message(partial: Omit<Message, "id" | "at">): Message {
  return { id: crypto.randomUUID(), at: now(), ...partial };
}

async function complete(system: string, history: { role: "user" | "assistant"; content: string }[]) {
  const client = getClient();
  if (!client) return null;
  const response = await client.chat.completions.create({
    model: modelName(),
    temperature: 0.7,
    messages: [{ role: "system", content: system }, ...history],
  });
  return sanitizeLine(response.choices[0]?.message?.content ?? "");
}

function spokenHistory(messages: Message[]) {
  return messages
    .filter((item) => item.role === "user" || item.role === "character" || item.role === "mirror-self")
    .slice(-12)
    .map((item) => ({
      role: item.role === "user" ? ("user" as const) : ("assistant" as const),
      content: item.text,
    }));
}

function parts(thread: Thread) {
  const scene = getScene(thread.slug);
  const script = getScript(thread.slug);
  if (!scene || !script) throw new HttpError("That scenario is missing its script.", 500);
  return { scene, script };
}

export async function listShowings() {
  return listThreads();
}

async function takeThread(id: string, snapshot: unknown) {
  const stored = await getThread(id);
  if (stored) return stored;
  const carried = asThread(snapshot);
  if (!carried || carried.id !== id) return null;
  if (!getScene(carried.slug) || !getScript(carried.slug)) return null;
  return carried;
}

export async function readShowing(id: string) {
  const thread = await getThread(id);
  if (!thread) throw new HttpError("That conversation could not be found.", 404);
  return thread;
}

export async function openShowing(slug: string) {
  const scene = getScene(slug);
  const script = getScript(slug);
  if (!scene || !script) throw new HttpError("That scenario doesn't exist.", 404);
  const thread: Thread = {
    id: crypto.randomUUID(),
    slug,
    act: "talk",
    messages: [message({ role: "character", text: script.opening, voice: "house" })],
    mirrorMessages: [],
    progress: newProgress(),
    revealed: false,
    voice: "house",
    createdAt: now(),
    updatedAt: now(),
    endedAt: null,
    feedback: null,
  };
  try {
    return await persistThread(thread);
  } catch (error) {
    console.error("Could not store the new chat:", error instanceof Error ? error.message : error);
    return thread;
  }
}

export async function speak(threadId: string, text: string, mode: "talk" | "mirror", snapshot?: unknown) {
  const thread = await takeThread(threadId, snapshot);
  if (!thread) throw new HttpError("That conversation could not be found.", 404);
  const { scene, script } = parts(thread);

  if (mode === "mirror") {
    if (thread.act !== "mirror") throw new HttpError("Sit in their chair before you answer as them.");
    const profile = styleProfile(
      thread.messages.filter((item) => item.role === "user").map((item) => item.text),
      script.keywords,
    );
    thread.mirrorMessages.push(message({ role: "user", text }));
    const turnIndex = thread.mirrorMessages.filter((item) => item.role === "mirror-self").length;
    let line = "";
    let voice: Voice = "house";
    try {
      line = (await complete(mirrorSystem(scene, profile), spokenHistory(thread.mirrorMessages))) ?? "";
    } catch (error) {
      console.error("Mirror model failed:", error instanceof Error ? error.message : "unknown");
    }
    if (!line) line = mirrorFallback(profile, turnIndex);
    else voice = "live";
    thread.mirrorMessages.push(message({ role: "mirror-self", text: line, voice }));
    thread.voice = voice;
    return saveThread(thread);
  }

  if (thread.act !== "talk" || thread.progress.outcome !== "open") {
    throw new HttpError("This conversation has ended.");
  }

  const label = await labelTurn(scene, thread.messages, text);
  const turn = applyLabel(thread.progress, label, scene.criteria);
  const justRevealed = !thread.revealed && turn.newlyMet.includes("C1");
  thread.progress = turn.progress;
  if (justRevealed) thread.revealed = true;
  thread.messages.push(message({ role: "user", text, label }));

  let line = "";
  let voice: Voice = "house";
  try {
    line = (await complete(characterSystem(scene, script, thread, turn, justRevealed), spokenHistory(thread.messages))) ?? "";
  } catch (error) {
    console.error("Scene model failed:", error instanceof Error ? error.message : "unknown");
  }
  if (line) voice = "live";
  else {
    line = scriptedLine(script, {
      outcome: turn.progress.outcome,
      warnNow: turn.warnNow,
      justRevealed,
      newlyMet: turn.newlyMet,
      struck: turn.struck,
      strikes: turn.progress.strikes,
      prior: thread.messages.filter((item) => item.role === "character").map((item) => item.text),
    });
  }
  thread.voice = voice;
  thread.messages.push(message({ role: "character", text: line, voice }));

  if (turn.progress.outcome !== "open") {
    thread.endedAt = now();
    thread.act = "review";
  }
  return saveThread(thread);
}

export async function changeAct(threadId: string, act: "mirror" | "review", snapshot?: unknown) {
  const thread = await takeThread(threadId, snapshot);
  if (!thread) throw new HttpError("That conversation could not be found.", 404);
  const { scene } = parts(thread);
  if (thread.progress.outcome === "open") throw new HttpError("Finish the conversation first.");
  if (act === "mirror" && !thread.feedback) throw new HttpError("Read your review before you switch chairs.");

  thread.act = act;
  if (act === "mirror" && thread.mirrorMessages.length === 0) {
    thread.mirrorMessages.push(
      message({
        role: "stage",
        text: `You are ${scene.character.name} now. The voice across from you is built from your own lines. Say something to them.`,
      }),
    );
  }
  return saveThread(thread);
}

export async function giveFeedback(threadId: string, snapshot?: unknown) {
  const thread = await takeThread(threadId, snapshot);
  if (!thread) throw new HttpError("That conversation could not be found.", 404);
  const { scene } = parts(thread);
  if (thread.progress.outcome === "open") throw new HttpError("The review opens when the conversation ends.");
  if (!thread.feedback) thread.feedback = await buildFeedback(thread, scene);
  return saveThread(thread);
}
