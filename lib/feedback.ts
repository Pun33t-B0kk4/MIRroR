import "server-only";

import { completeJson } from "@/lib/openai";
import type { Feedback, Message, ResponseFeedback, ScenePublic, Thread, TurnLabel } from "@/lib/types";
import { clip } from "@/lib/utils";

/*
 * Role-reversal feedback: for every line the user wrote, how it was probably
 * received from the friend's side, plus a line to try instead. Always shown at
 * the end of a scenario, whether it resolved or went into cooldown.
 */

function tagFor(label: TurnLabel | undefined, scene: ScenePublic) {
  if (!label) return { result: "neutral" as const, tag: "Neutral" };
  if (label.strike) return { result: "strike" as const, tag: `Strike: ${label.strike} miss` };
  if (label.met.length) {
    const names = label.met
      .map((id) => `${id} met: ${scene.criteria.find((criterion) => criterion.id === id)?.label ?? id}`)
      .join(" · ");
    return { result: "met" as const, tag: names };
  }
  return { result: "neutral" as const, tag: "Neutral" };
}

function pairs(messages: Message[]) {
  const out: { line: Message; reply: string }[] = [];
  messages.forEach((item, index) => {
    if (item.role !== "user") return;
    const reply = messages.slice(index + 1).find((next) => next.role === "character" || next.role === "user");
    out.push({ line: item, reply: reply?.role === "character" ? reply.text : "" });
  });
  return out.slice(-20);
}

function fallbackFor(label: TurnLabel | undefined, scene: ScenePublic) {
  const name = scene.character.name;
  if (label?.strike) {
    const criterion = scene.criteria.find((item) => item.id === label.strike);
    return {
      pros: [],
      cons: [criterion ? `This worked against "${criterion.label.toLowerCase()}". ${label.note}`.trim() : "This pushed the conversation backward."],
      tryInstead: `Slow down and ask ${name} what it was like for them.`,
    };
  }
  if (label?.met.length) {
    return {
      pros: label.met.map((id) => {
        const criterion = scene.criteria.find((item) => item.id === id);
        return criterion ? `Strong: ${criterion.label.toLowerCase()}.` : "This moved things forward.";
      }),
      cons: [],
      tryInstead: "Keep this. It worked.",
    };
  }
  return {
    pros: ["Kept the conversation going."],
    cons: ["Didn't move things forward on its own."],
    tryInstead: `Ask ${name} directly about their side.`,
  };
}

function strings(value: unknown, max = 3) {
  if (!Array.isArray(value)) return null;
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => clip(item, 280))
    .filter(Boolean)
    .slice(0, max);
}

function headline(thread: Thread, scene: ScenePublic) {
  const name = scene.character.name;
  if (thread.progress.outcome === "cooldown") {
    return `${name} stepped away before the conversation got where it needed to go. The lines below show where it turned, from ${name}'s side.`;
  }
  if (thread.progress.strikes === 0) {
    return `You got there cleanly. ${name} felt heard, and the lines below show why.`;
  }
  return `You got there, with a few lines that pulled the other way. The review below shows which ones, from ${name}'s side.`;
}

export async function buildFeedback(thread: Thread, scene: ScenePublic): Promise<Feedback> {
  const rows = pairs(thread.messages);
  const name = scene.character.name;
  const outcome =
    thread.progress.outcome === "cooldown"
      ? `The conversation ended in cooldown: ${name} walked away.`
      : `The conversation was resolved.`;

  let data: Record<string, unknown> | null = null;
  try {
    const system = [
      `You are a warm, honest communication coach reviewing a practice conversation from ${name}'s side.`,
      `What happened: ${scene.premise}`,
      `${name}: ${scene.character.role}. ${scene.character.personality}`,
      `Skills being practiced: ${scene.criteria.map((criterion) => `${criterion.id} ${criterion.label}`).join("; ")}.`,
      outcome,
      "For every numbered line the user wrote, explain how it was probably received by the friend. Refer to their actual words. Be kind and specific. Do not flatter.",
      "Each line has a tag from a grader (criterion met, strike, or neutral). Agree with it in your explanation. Never mention points or scores.",
      'Return only JSON: {"summary": string, "pros": string[], "cons": string[], "responses": [{"n": number, "pros": string[], "cons": string[], "tryInstead": string}]}',
      `summary is two sentences addressed to the user as "you".${thread.progress.outcome === "cooldown" ? " The second sentence is the main takeaway to think about during the cooldown." : ""}`,
      "Overall pros and cons have 2 to 4 items each. Each response has 0 to 3 pros and 0 to 3 cons. tryInstead is one line the user could have said instead, written as dialogue; for a strong line, it can be a short note to keep doing this.",
    ].join("\n");
    const user = rows
      .map(
        (row, index) =>
          `${index + 1}. You said: "${row.line.text}" [${tagFor(row.line.label, scene).tag}]` +
          (row.reply ? `\n   ${name} replied: "${row.reply}"` : ""),
      )
      .join("\n");
    data = await completeJson(system, user, 1800, 0.4);
  } catch (error) {
    console.error("Feedback model failed:", error instanceof Error ? error.message : "unknown");
  }

  const live = Array.isArray(data?.responses) ? (data.responses as Record<string, unknown>[]) : [];
  const responses: ResponseFeedback[] = rows.map((row, index) => {
    const found = live.find((item) => item && Number(item.n) === index + 1);
    const base = fallbackFor(row.line.label, scene);
    const pros = strings(found?.pros);
    const cons = strings(found?.cons);
    const tryInstead =
      typeof found?.tryInstead === "string" && found.tryInstead.trim() ? clip(found.tryInstead, 280) : base.tryInstead;
    return {
      messageId: row.line.id,
      text: row.line.text,
      reply: row.reply,
      ...tagFor(row.line.label, scene),
      pros: pros ?? base.pros,
      cons: cons ?? base.cons,
      tryInstead,
    };
  });

  const pros = strings(data?.pros, 4);
  const cons = strings(data?.cons, 4);
  const summary =
    typeof data?.summary === "string" && data.summary.trim() ? clip(data.summary, 480) : headline(thread, scene);
  const metNames = scene.criteria.filter((criterion) => thread.progress.met.includes(criterion.id)).map((criterion) => criterion.label);
  const missedNames = scene.criteria.filter((criterion) => !thread.progress.met.includes(criterion.id)).map((criterion) => criterion.label);

  return {
    summary,
    pros: pros?.length ? pros : metNames.length ? metNames : ["You stayed in the conversation."],
    cons: cons?.length ? cons : missedNames.length ? missedNames.map((label) => `Not yet: ${label.toLowerCase()}.`) : ["Let each apology stand on its own."],
    responses,
    createdAt: new Date().toISOString(),
  };
}
