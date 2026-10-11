import type { SignalKey, Signals } from "./types";
import { clip } from "./utils";

/*
 * Keyword signal detection. In the redesign this no longer drives a hidden
 * relationship meter. It backs two things: the rule-based turn labeler used
 * when the model is unavailable (lib/labels.ts), and the mirror style profile.
 */

export const SIGNAL_KEYS: SignalKey[] = [
  "accusation",
  "curiosity",
  "apology",
  "justification",
  "honesty",
  "kindness",
  "respectBoundary",
  "demandForgiveness",
  "contempt",
  "assumption",
  "specific",
  "appeasement",
  "question",
];


export function emptySignals(): Signals {
  return {
    accusation: 0,
    curiosity: 0,
    apology: 0,
    justification: 0,
    honesty: 0,
    kindness: 0,
    respectBoundary: 0,
    demandForgiveness: 0,
    contempt: 0,
    assumption: 0,
    specific: 0,
    appeasement: 0,
    question: 0,
  };
}

export function addSignals(left: Signals, right: Signals): Signals {
  const next = emptySignals();
  for (const key of SIGNAL_KEYS) next[key] = left[key] + right[key];
  return next;
}

function mentioned(text: string, re: RegExp): boolean {
  const copy = new RegExp(re.source, re.flags.replace("g", ""));
  const match = copy.exec(text);
  if (!match || match.index === undefined) return false;
  const before = text.slice(Math.max(0, match.index - 18), match.index);
  const clause = before.split(/[.!?]/).pop() ?? before;
  return !/\b(not|never|no|aren'?t|isn'?t|don'?t|doesn'?t|didn'?t)\b/i.test(clause);
}

export function detectSignals(text: string, keywords: string[]): Signals {
  const signals = emptySignals();
  const raw = text.trim();
  if (!raw) return signals;

  const hit = (re: RegExp) => mentioned(raw, re);

  if (
    hit(/\byou always\b/i) ||
    hit(/\byou never\b/i) ||
    hit(/\byour fault\b/i) ||
    hit(/\byou (didn't|did not|haven't|have not)\b/i) ||
    hit(/\bwhy didn't you\b/i) ||
    hit(/\byou dropped the ball\b/i) ||
    hit(/\byou screwed\b/i) ||
    hit(/\byou('re| are) useless\b/i)
  ) {
    signals.accusation = 1;
  }

  if (
    hit(/\bhelp me understand\b/i) ||
    hit(/\bwhat happened\b/i) ||
    hit(/\bwhat was going on\b/i) ||
    hit(/\bwhat(?:'s| is) going on\b/i) ||
    hit(/\bon your side\b/i) ||
    hit(/\bare you (okay|ok|alright)\b/i) ||
    hit(/\bhow are you\b/i) ||
    hit(/\bcan you tell me\b/i) ||
    hit(/\bwhat do you need\b/i) ||
    hit(/\bwhat was that like\b/i) ||
    (/\?/.test(raw) &&
      hit(/\b(what|how|why|when)\b/i) &&
      !hit(/\bwhy didn't you\b/i))
  ) {
    signals.curiosity = 1;
  }

  if (/\?/.test(raw)) signals.question = 1;

  if (
    !/\bnot sorry\b/i.test(raw) &&
    (hit(/\bi(?:'| a)?m sorry\b/i) ||
      hit(/\bi apologize\b/i) ||
      hit(/\bi was wrong\b/i) ||
      hit(/\bi messed up\b/i) ||
      hit(/\bthat was on me\b/i) ||
      hit(/\bi hurt you\b/i) ||
      hit(/\bi(?:'| a)?m responsible\b/i))
  ) {
    signals.apology = 1;
  }

  if (
    hit(/\bjust a joke\b/i) ||
    hit(/\bi didn't mean\b/i) ||
    hit(/\bi did not mean\b/i) ||
    hit(/\boverreact/i) ||
    hit(/\bcalm down\b/i) ||
    (signals.apology === 1 && /\bbut\b/i.test(raw))
  ) {
    signals.justification = 1;
  }

  if (
    hit(/\bi need\b/i) ||
    hit(/\bi needed\b/i) ||
    (hit(/\bi feel\b/i) && !/\bi feel like you\b/i.test(raw)) ||
    hit(/\bi felt\b/i) ||
    hit(/\bi was hurt\b/i) ||
    hit(/\bi(?:'| a)?m asking\b/i) ||
    hit(/\bwhat i want\b/i) ||
    hit(/\bi (just )?want\b/i) ||
    hit(/\bi want us\b/i) ||
    hit(/\bcan we figure\b/i) ||
    hit(/\bi have to be honest\b/i) ||
    hit(/\bi want to be honest\b/i)
  ) {
    signals.honesty = 1;
  }

  if (
    hit(/\bthat sounds\b/i) ||
    hit(/\bi can see\b/i) ||
    hit(/\bmakes sense\b/i) ||
    hit(/\bthank you for\b/i) ||
    hit(/\bthat must\b/i) ||
    hit(/\bi imagine\b/i)
  ) {
    signals.kindness = 1;
  }

  if (
    hit(/\byou don(?:'|’)t have to\b/i) ||
    hit(/\byou do not have to\b/i) ||
    hit(/\byou don(?:'|’)t owe\b/i) ||
    hit(/\byou do not owe\b/i) ||
    hit(/\bno pressure\b/i) ||
    hit(/\btake your time\b/i) ||
    hit(/\byour (choice|call)\b/i) ||
    hit(/\bi can wait\b/i)
  ) {
    signals.respectBoundary = 1;
  }

  if (
    hit(/\bjust forgive\b/i) ||
    hit(/\bget over it\b/i) ||
    hit(/\bjust move on\b/i) ||
    hit(/\byou need to move on\b/i) ||
    hit(/\blet it go\b/i) ||
    hit(/\btoo sensitive\b/i) ||
    hit(/\bdon(?:'|’)t be dramatic\b/i) ||
    hit(/\bstop being so\b/i)
  ) {
    signals.demandForgiveness = 1;
  }

  if (
    hit(/\bidiot\b/i) ||
    hit(/\bstupid\b/i) ||
    hit(/\bpathetic\b/i) ||
    hit(/\bshut up\b/i) ||
    hit(/\bgrow up\b/i) ||
    hit(/\bscrew you\b/i) ||
    hit(/\bi hate you\b/i)
  ) {
    signals.contempt = 1;
  }

  if (
    hit(/\byou don(?:'|’)t care\b/i) ||
    hit(/\byou do not care\b/i) ||
    hit(/\byou(?:'re| are) lazy\b/i) ||
    hit(/\byou ignored\b/i) ||
    hit(/\byou don(?:'|’)t respect\b/i) ||
    hit(/\byou do not respect\b/i)
  ) {
    signals.assumption = 1;
  }

  const lower = raw.toLowerCase();
  if (keywords.some((word) => lower.includes(word.toLowerCase()))) {
    signals.specific = 1;
  }

  if (signals.assumption && signals.apology && /\bwrong to\b/i.test(raw)) {
    signals.assumption = 0;
  }

  const onlySmooth =
    /^(ok|okay|fine|it's fine|its fine|no worries|all good|we're good|we are good|forget it|don't worry about it|it's okay|its okay|all right|alright)\.?$/i.test(
      raw,
    );
  const shortSmooth =
    raw.length <= 42 &&
    /\b(no worries|it's fine|its fine|all good|we're good|forget it)\b/i.test(raw) &&
    !/\b(but|need|felt|sorry|what|why|how)\b/i.test(raw);
  if ((onlySmooth || shortSmooth) && !signals.honesty && !signals.apology) {
    signals.appeasement = 1;
  }

  return signals;
}

export function charge(signals: Signals) {
  return (
    signals.accusation * 2 +
    signals.assumption * 2 +
    signals.contempt * 3 +
    signals.demandForgiveness * 2 +
    signals.justification
  );
}

export type StyleProfile = {
  summary: string;
  traits: string[];
  sharpest: string;
  ranked: string[];
};

export function styleProfile(lines: string[], keywords: string[] = []): StyleProfile {
  const ranked = [...lines].sort(
    (a, b) => charge(detectSignals(b, keywords)) - charge(detectSignals(a, keywords)),
  );
  const totals = lines.reduce(
    (sum, line) => addSignals(sum, detectSignals(line, keywords)),
    emptySignals(),
  );
  const avg =
    lines.reduce((sum, line) => sum + line.length, 0) / Math.max(1, lines.length);
  const traits: string[] = [];
  traits.push(avg < 90 ? "short lines" : "long lines");
  if (totals.accusation > totals.curiosity && totals.accusation > 0) {
    traits.push("verdicts before questions");
  }
  if (totals.curiosity > totals.accusation) traits.push("questions");
  if (totals.apology && totals.justification) traits.push("apologies with a defense attached");
  else if (totals.apology) traits.push("direct apologies");
  if (totals.honesty) traits.push("naming what you need");
  if (totals.contempt) traits.push("contempt");
  const summary = lines.length
    ? `Your voice in this scene: ${traits.join(", ")}.`
    : "Your voice in this scene is still thin. A few more lines and the mirror gets sharper.";
  return {
    summary,
    traits,
    sharpest: ranked[0] ?? "",
    ranked,
  };
}

export function mirrorFallback(profile: StyleProfile, turnIndex: number) {
  const line = profile.ranked[turnIndex];
  if (line) return line;
  if (profile.sharpest) {
    return `I'm still on what I said. “${clip(profile.sharpest, 180)}”`;
  }
  return "Say something. I'm waiting.";
}
