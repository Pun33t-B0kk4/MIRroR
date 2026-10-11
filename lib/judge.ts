import "server-only";

import { heuristicLabel, parseLabel } from "@/lib/labels";
import { completeJson } from "@/lib/openai";
import type { Message, ScenePublic, TurnLabel } from "@/lib/types";

/*
 * Labels one user turn against the scenario's criteria. This is a separate
 * model call from the friend's reply, so the character never has to keep
 * score. If the call fails or returns something unusable, the rule-based
 * labeler takes over.
 */

function system(scene: ScenePublic) {
  const criteria = scene.criteria
    .map((criterion) => `${criterion.id}: ${criterion.label}\n  Meets when: ${criterion.meets}\n  Strike when: ${criterion.misses}`)
    .join("\n");
  return [
    "You grade one line in a practice conversation. The user hurt a friend with a joke at a party, and the friend is confronting them.",
    `Friend: ${scene.character.name}, ${scene.character.role}. ${scene.premise}`,
    "Criteria:",
    criteria,
    "Rules:",
    "- Judge only the LAST user line, using the earlier conversation as context.",
    "- A line is a strike if it works against any criterion. Give at most one strike, naming the criterion it misses most.",
    "- A strike line meets nothing, even if part of it was good.",
    "- If it is not a strike, list every criterion the line fully meets. Partial attempts meet nothing.",
    "- A question counts for C1 only if it is about the friend's own experience. Rhetorical, deflecting, or impatient questions, and questions about other people, do not count, and can be strikes.",
    "- Small talk, short acknowledgements, and filler are neutral: no criteria and no strike.",
    "- Be strict. Do not give credit the line did not earn.",
    'Return only JSON: {"met": ["C1"], "strike": null, "note": "one short sentence"} or {"met": [], "strike": "C2", "note": "..."}',
  ].join("\n");
}

function transcript(messages: Message[], name: string, text: string) {
  const earlier = messages
    .filter((item) => item.role === "user" || item.role === "character")
    .slice(-10)
    .map((item) => `${item.role === "user" ? "User" : name}: ${item.text}`)
    .join("\n");
  return `${earlier}\nUser (grade this line): ${text}`;
}

export async function labelTurn(scene: ScenePublic, messages: Message[], text: string): Promise<TurnLabel> {
  const earlierUserLines = messages.filter((item) => item.role === "user").map((item) => item.text);
  try {
    const data = await completeJson(system(scene), transcript(messages, scene.character.name, text), 200, 0.1);
    const label = parseLabel(data, scene);
    if (label) return label;
  } catch (error) {
    console.error("Turn labeler failed:", error instanceof Error ? error.message : "unknown");
  }
  return heuristicLabel(scene.slug, text, scene.criteria, earlierUserLines);
}
