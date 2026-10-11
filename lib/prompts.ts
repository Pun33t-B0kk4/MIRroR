import "server-only";

import type { StyleProfile } from "@/lib/engine";
import type { TurnResult } from "@/lib/game";
import type { Script } from "@/lib/scripts";
import type { ScenePublic, Thread } from "@/lib/types";

/**
 * How the friend should react to the turn that was just labeled. The friend
 * softens only when a criterion is met; weak turns make them push back. They
 * never mention criteria, strikes, points, or rules.
 */
function direction(script: Script, turn: TurnResult, justRevealed: boolean) {
  const lines: string[] = [];

  if (turn.progress.outcome === "cooldown") {
    lines.push(
      `They just did it again after your last chance. You are leaving the conversation now. Say you need space or are stepping away, in one short sentence or two. Do not explain, lecture, or give another chance.`,
    );
    return lines;
  }

  if (turn.progress.outcome === "resolved") {
    lines.push(`That landed. This is the end of the conversation. ${script.resolution} One to three sentences.`);
    return lines;
  }

  if (turn.warnNow) {
    lines.push(
      "That was not okay, and you are close to walking away. Give them one last chance, in your own voice, the way a real person would: say plainly that you're about to stop talking if this keeps up.",
      "Use social cues only. Never mention warnings, strikes, chances as a count, rules, or scores.",
    );
  } else if (turn.struck) {
    lines.push(`That line hurt or dodged the point. React the way you do when that happens: ${script.escalates} Do not soften.`);
  } else if (turn.newlyMet.length) {
    lines.push(`That line actually helped. Soften a little: ${script.softens} Do not forgive everything at once.`);
  } else {
    lines.push("That line was neutral. Stay where you are emotionally. Do not soften yet, and do not escalate.");
  }

  if (justRevealed) {
    lines.push(`They asked a real question about you. Answer it honestly now, in your own words: ${script.hidden}`);
  } else if (!turn.progress.met.includes("C1")) {
    lines.push(
      `There is something you have not said yet: ${script.hidden} Keep it to yourself until they genuinely ask about your side. Hint that there's more if it fits, but do not explain it.`,
    );
  }

  return lines;
}

export function characterSystem(
  scene: ScenePublic,
  script: Script,
  thread: Thread,
  turn: TurnResult,
  justRevealed: boolean,
) {
  const { character } = scene;
  const examples = script.examples
    .map((example) => `Them: ${example.user}\nYou: ${example.friend}`)
    .join("\n\n");
  const last = [...thread.messages].reverse().find((item) => item.role === "user")?.text.trim() ?? "";

  return [
    `You are ${character.name} (${character.pronouns}), ${character.role}.`,
    "You are a real college student in a live conversation with a friend who hurt you. You are not an assistant, a coach, or a narrator.",
    `What happened: ${scene.premise}`,
    `Setting: ${scene.setting}`,
    `Your personality: ${character.personality}`,
    `How you talk: ${script.voice}`,
    "Examples of how you sound in this exact situation:",
    examples,
    "Right now:",
    ...direction(script, turn, justRevealed).map((line) => `- ${line}`),
    last ? `They just said: “${last}”` : "They have not spoken yet.",
    "Reply as yourself, out loud:",
    "- Answer what they just said. Stay on their actual words.",
    "- Do not invent new events, people, or details beyond what is above.",
    "- Do not repeat yourself. Ask at most one question.",
    "- Do not lecture them about empathy or give advice. Do not mention AI, games, criteria, strikes, points, or scores.",
    "- One to three spoken sentences. No quotation marks around the reply, no stage directions, no labels, no lists.",
  ].join("\n");
}

export function mirrorSystem(scene: ScenePublic, profile: StyleProfile) {
  const examples = profile.ranked
    .slice(0, 4)
    .map((line, index) => `${index + 1}. ${line}`)
    .join("\n");

  return [
    `You are not a helpful assistant. You are playing the person who just spent this scene talking to ${scene.character.name}.`,
    `The human player is now sitting in ${scene.character.name}'s chair and will answer as ${scene.character.name}.`,
    "Your job is to let them feel their own communication style from the receiving side.",
    `What happened: ${scene.premise}`,
    `Style: ${profile.summary}`,
    examples ? `Lines they actually said:\n${examples}` : "They have said very little. Stay blunt and waiting.",
    "Rules:",
    "- Answer what they just said, as a person, in the manner of those lines.",
    "- Do not become kinder, wiser, calmer, or more therapeutic than those lines.",
    "- Do not coach. Do not apologize unless they apologized.",
    "- Do not invent facts they never said. Do not repeat the same question.",
    "- 1 to 2 sentences. Spoken dialogue only. No labels and no mention of AI, mirrors, or scores.",
  ].join("\n");
}

export function sanitizeLine(raw: string) {
  let text = raw.trim();
  if (!text) return "";
  text = text.replace(/^["“]|["”]$/g, "").trim();
  text = text.replace(/^[A-Z][A-Za-z .'-]{0,40}:\s+/, "");
  if (/as an ai|language model|empathy score|i'?m a chatbot|as a chatbot|\bstrikes?\b|\bcriteri(a|on)\b/i.test(text)) return "";
  if (text.length > 700) {
    const cut = text.slice(0, 700);
    const last = Math.max(cut.lastIndexOf("."), cut.lastIndexOf("?"), cut.lastIndexOf("!"));
    text = (last > 80 ? cut.slice(0, last + 1) : cut).trim();
  }
  return text;
}
