import type { Criterion, CriterionId, Expression, Progress, TurnLabel } from "./types";

/*
 * The pass/fail rules from the scenario spec. Pure functions only, so they run
 * on the server, in the browser, and in tests.
 *
 * - A criterion counts once its first qualifying turn lands, in any order.
 * - A strike is a turn that works against a criterion. Strikes never reset,
 *   and meeting a criterion never erases one.
 * - Strike 3: the friend gives an in-character last chance (no UI warning).
 * - Strike 4: the friend exits and the scenario goes into cooldown.
 * - Meeting the last criterion before strike 4 resolves the scenario.
 */

export const STRIKE_LIMIT = 4;
export const WARNING_AT = 3;
/** Simulated lockout length. Enforced only in the browser (proof of concept). */
export const COOLDOWN_MS = 6 * 60 * 60 * 1000;

export function newProgress(): Progress {
  return { met: [], strikes: 0, warned: false, outcome: "open" };
}

export type TurnResult = {
  progress: Progress;
  newlyMet: CriterionId[];
  struck: boolean;
  /** True on the turn that brings the user to strike 3. */
  warnNow: boolean;
};

export function applyLabel(progress: Progress, label: TurnLabel, criteria: Criterion[]): TurnResult {
  if (progress.outcome !== "open") {
    throw new Error("This conversation has already ended.");
  }
  const next: Progress = { ...progress, met: [...progress.met] };

  if (label.strike) {
    next.strikes += 1;
    const warnNow = next.strikes === WARNING_AT && !next.warned;
    if (warnNow) next.warned = true;
    if (next.strikes >= STRIKE_LIMIT) next.outcome = "cooldown";
    return { progress: next, newlyMet: [], struck: true, warnNow };
  }

  const ids = new Set(criteria.map((criterion) => criterion.id));
  const newlyMet = label.met.filter((id) => ids.has(id) && !next.met.includes(id));
  next.met.push(...newlyMet);
  next.met.sort();
  if (criteria.every((criterion) => next.met.includes(criterion.id))) {
    next.outcome = "resolved";
  }
  return { progress: next, newlyMet, struck: false, warnNow: false };
}

/** The friend's face, read from hidden progress. Never shows numbers. */
export function expressionFor(progress: Progress): Expression {
  if (progress.outcome === "cooldown") return "firm";
  if (progress.outcome === "resolved") return "open";
  if (progress.strikes >= WARNING_AT) return "bristling";
  if (progress.met.length >= 2) return "listening";
  if (progress.met.length === 1) return "steady";
  return "guarded";
}

export function cooldownEndsAt(endedAt: string | null) {
  if (!endedAt) return 0;
  return new Date(endedAt).getTime() + COOLDOWN_MS;
}

export function formatWait(ms: number) {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}
