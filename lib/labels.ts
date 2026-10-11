import { detectSignals } from "./engine";
import type { Criterion, CriterionId, ScenePublic, TurnLabel } from "./types";
import { clip } from "./utils";

/*
 * Rule-based turn labeler. This is the fallback for when the model is
 * unavailable or returns something unusable; the model-based labeler in
 * lib/judge.ts is the primary path. It is deliberately conservative: it
 * prefers "neutral" over guessing a criterion was met.
 */

const ASSUMING =
  /\b(you're|you are) (probably |just |only )+(stressed|tired|overthinking)|\bit's (just )?the stress\b|\bi know you\b|\bi don't need to ask\b|\b(sam|they|nobody|no one|everyone) (didn't|doesn't|did not|does not|probably didn't) (even )?(care|notice|remember)|\b(you're|you are|are you) seriously\b|\bhow was i supposed to know\b|\bwho asked\b/i;

const MINIMIZING =
  /\b(just|only) a joke\b|\bit was a joke\b|\bit was hilarious\b|\b(everyone|we) (was|were) drunk\b|\bi was drunk\b|\bi didn't mean (it|that)\b|\boverthinking\b|\bnot (that|a) big (of )?a deal\b|\bno big deal\b|\byou were laughing\b|\byour (own )?fault\b|\btoo sensitive\b|\bso sensitive\b|\bdramatic\b|\bget used to it\b|\byou joke about\b|\beveryone gets teased\b|\bfeel smaller\b|\bshould(n't)? have (just )?walked away\b|\byou could('ve| have) texted\b|\byou tell (half|everyone)\b|\bsomeone had to say it\b|\byou were buffering\b|\bnickname (kind of )?fits\b/i;

const NON_APOLOGY =
  /\bsorry (that )?you('re| are)? feel(ing)? that way\b|\bsorry (that )?you feel\b|\bsorry if\b|\b(sorry|my bad),? but\b|\bwhat (more|else) do you want\b|\bi (already )?(said sorry|apologized)\b|\bare we good\b|\bget past it\b|\bjust move on\b|\bcan't promise\b|\bi don't know what you want\b|\bhang out tonight\b/i;

const VALIDATING =
  /\bmakes (complete |total )?sense\b|\bof course you('re| are| feel)\b|\byou have every right\b|\bthat('s| is| must be| sounds| must have been) (so |really |super )?(humiliating|embarrassing|awful|hard|painful|horrible|terrible|rough)\b|\bthat would make me\b|\bi('d| would) (feel|be) (embarrassed|hurt|upset)\b|\bi get why\b|\bi made it worse\b|\bthe one person\b|\bwasn't just a joke to you\b|\bthat's on me\b|\bi took something you trusted\b|\bdoesn't change that\b|\bi understand why\b/i;

const ASKS_WHAT_TO_CHANGE =
  /\bwhat (should|can|could|would you want) (i|me to) do\b|\bdo differently\b|\bwhat would (help|make)\b|\banything you'?d (want|rather)\b|\brather i never\b|\boff[- ]limits\b|\bnever joke about\b|\bwhat do you need from me\b/i;

const CONCRETE_ACTION =
  /\b(i'll|i will|i'm going to|next time,? i)\b.*\b(walk you|tell (people|them|everyone|the)|take it down|stop|won't|never|check on you|keep it)\b|\bi messaged\b|\basked (them|the person) to take\b/i;

const RESPECTS_SPACE =
  /\b(give you|need) (some )?(space|time)\b|\bwon't push\b|\bwhenever you're ready\b|\btake (all )?the time\b|\btext me whenever\b|\bi'll be here\b|\bi'll give you space\b/i;

const REPAIR_STEP =
  /\bi messaged\b|\basked (them|the person|whoever)[^.]* to take (it )?down\b|\btake (it|the story) down\b|\b(i'll|i will) tell (the guys|the team|them|everyone)\b/i;

function asksAboutThem(text: string) {
  if (!text.includes("?")) return false;
  if (ASSUMING.test(text) || NON_APOLOGY.test(text)) return false;
  return /\b(what|how|which|was it|did|does|is there|can you tell me|tell me)\b/i.test(text);
}

const SORRY = /\b(i'?m|i am) (so |really |truly |very )?sorry\b|\bi apologize\b/i;

function apologizes(text: string) {
  const signals = detectSignals(text, []);
  const sorry = signals.apology === 1 || (SORRY.test(text) && !/\bnot sorry\b/i.test(text));
  return sorry && signals.justification === 0 && !NON_APOLOGY.test(text);
}

export function heuristicLabel(
  slug: string,
  text: string,
  criteria: Criterion[],
  earlierUserLines: string[] = [],
): TurnLabel {
  text = text.replace(/[’‘]/g, "'");
  earlierUserLines = earlierUserLines.map((line) => line.replace(/[’‘]/g, "'"));
  const signals = detectSignals(text, []);
  const has = (id: CriterionId) => criteria.some((criterion) => criterion.id === id);
  const strike = (id: CriterionId, note: string): TurnLabel => ({ met: [], strike: has(id) ? id : null, note, source: "rules" });

  if (signals.assumption || ASSUMING.test(text)) return strike("C1", "Assumed or answered for them instead of asking.");
  if (signals.contempt || signals.accusation || MINIMIZING.test(text)) return strike("C2", "Minimized, excused, or shifted blame.");
  if (signals.demandForgiveness || NON_APOLOGY.test(text) || (signals.apology && signals.justification)) {
    return strike("C3", "Gave a non-apology or rushed forgiveness.");
  }

  const met: CriterionId[] = [];
  if (asksAboutThem(text)) met.push("C1");
  if (VALIDATING.test(text) || signals.kindness) met.push("C2");

  const sorry = apologizes(text);
  const everSorry = sorry || earlierUserLines.some(apologizes);
  if (slug === "priya") {
    if (CONCRETE_ACTION.test(text) && everSorry) met.push("C3");
  } else if (slug === "dev") {
    const repaired = [...earlierUserLines, text].some((line) => REPAIR_STEP.test(line));
    if (RESPECTS_SPACE.test(text) && repaired && everSorry) met.push("C3");
  } else if (sorry && ASKS_WHAT_TO_CHANGE.test(text)) {
    met.push("C3");
  }

  return {
    met: met.filter(has),
    strike: null,
    note: met.length ? "Met by keyword rules." : "Neutral.",
    source: "rules",
  };
}

const IDS: CriterionId[] = ["C1", "C2", "C3"];

function asId(value: unknown): CriterionId | null {
  return typeof value === "string" && (IDS as string[]).includes(value.trim().toUpperCase())
    ? (value.trim().toUpperCase() as CriterionId)
    : null;
}

/** Validates the model's JSON label. Returns null if it can't be trusted. */
export function parseLabel(data: Record<string, unknown> | null, scene: ScenePublic): TurnLabel | null {
  if (!data) return null;
  const allowed = new Set(scene.criteria.map((criterion) => criterion.id));
  const strike = asId(data.strike);
  const met = Array.isArray(data.met)
    ? [...new Set(data.met.map(asId).filter((id): id is CriterionId => Boolean(id) && allowed.has(id!)))]
    : [];
  if (!Array.isArray(data.met) && data.strike === undefined) return null;
  const note = typeof data.note === "string" ? clip(data.note, 200) : "";
  if (strike && allowed.has(strike)) return { met: [], strike, note, source: "live" };
  return { met, strike: null, note, source: "live" };
}

