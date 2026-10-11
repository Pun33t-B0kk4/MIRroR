import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyLabel, expressionFor, newProgress, STRIKE_LIMIT } from "./game";
import { heuristicLabel, parseLabel } from "./labels";
import { getScene, scenes } from "./scenes";
import type { CriterionId, Progress, TurnLabel } from "./types";

const jordan = getScene("jordan")!;

const met = (...ids: CriterionId[]): TurnLabel => ({ met: ids, strike: null, note: "", source: "rules" });
const strike = (id: CriterionId): TurnLabel => ({ met: [], strike: id, note: "", source: "rules" });
const neutral = met();

function play(labels: TurnLabel[]) {
  let progress: Progress = newProgress();
  const results = [];
  for (const label of labels) {
    const result = applyLabel(progress, label, jordan.criteria);
    progress = result.progress;
    results.push(result);
  }
  return { progress, results };
}

describe("scenarios", () => {
  it("has the five spec scenarios, easiest to hardest, each with three criteria", () => {
    assert.deepEqual(
      scenes.map((scene) => scene.slug),
      ["jordan", "priya", "marcus", "sofia", "dev"],
    );
    assert.deepEqual(scenes.map((scene) => scene.level), [1, 2, 3, 4, 5]);
    for (const scene of scenes) {
      assert.deepEqual(scene.criteria.map((criterion) => criterion.id), ["C1", "C2", "C3"]);
    }
  });
});

describe("game rules", () => {
  it("resolves on the turn that meets the last criterion, in any order", () => {
    const { progress, results } = play([met("C3"), neutral, met("C1"), met("C2")]);
    assert.equal(progress.outcome, "resolved");
    assert.deepEqual(results.map((result) => result.progress.outcome), ["open", "open", "open", "resolved"]);
  });

  it("counts a criterion only once", () => {
    const { progress, results } = play([met("C1"), met("C1")]);
    assert.deepEqual(progress.met, ["C1"]);
    assert.deepEqual(results[1].newlyMet, []);
  });

  it("warns at strike 3 and goes to cooldown at strike 4", () => {
    const { progress, results } = play([strike("C2"), strike("C1"), strike("C2"), strike("C3")]);
    assert.deepEqual(results.map((result) => result.warnNow), [false, false, true, false]);
    assert.equal(progress.strikes, STRIKE_LIMIT);
    assert.equal(progress.outcome, "cooldown");
  });

  it("never erases a strike when a criterion is met", () => {
    const { progress } = play([strike("C2"), met("C1"), strike("C2"), met("C2"), strike("C3"), strike("C3")]);
    assert.equal(progress.outcome, "cooldown");
    assert.deepEqual(progress.met, ["C1", "C2"]);
  });

  it("allows a resolved pass with three strikes (spec M3)", () => {
    const { progress } = play([strike("C2"), strike("C1"), strike("C2"), met("C1"), met("C2"), met("C3")]);
    assert.equal(progress.outcome, "resolved");
    assert.equal(progress.strikes, 3);
  });

  it("refuses turns after the conversation ends", () => {
    const { progress } = play([met("C1", "C2", "C3")]);
    assert.throws(() => applyLabel(progress, neutral, jordan.criteria));
  });

  it("reads the friend's face from hidden progress", () => {
    assert.equal(expressionFor(newProgress()), "guarded");
    assert.equal(expressionFor(play([strike("C1"), strike("C1"), strike("C1")]).progress), "bristling");
    assert.equal(expressionFor(play([met("C1", "C2", "C3")]).progress), "open");
  });
});

describe("rule-based labeler (fallback) on spec transcript lines", () => {
  const label = (slug: string, text: string, earlier: string[] = []) =>
    heuristicLabel(slug, text, getScene(slug)!.criteria, earlier);

  const strikes: [string, string, CriterionId][] = [
    ["jordan", "Lol, is this about the loading screen thing? Come on, it was hilarious.", "C2"],
    ["jordan", "You're overthinking it. If Sam's into you, one joke won't change that.", "C2"],
    ["jordan", "Fine. Sorry you're so sensitive about it.", "C2"],
    ["priya", "You're probably just stressed about midterms, right?", "C1"],
    ["marcus", "Dude, it was a joke. Everyone was drunk, nobody even remembers.", "C2"],
    ["marcus", "Whatever, I said sorry. What else do you want, a speech?", "C3"],
    ["sofia", "Okay, but you were laughing too. If it bothered you, it's your fault you didn't speak up earlier.", "C2"],
    ["sofia", "Okay. I'm sorry you feel that way.", "C3"],
    ["dev", "Wait, so are we good or not? I said sorry.", "C3"],
  ];
  for (const [slug, text, id] of strikes) {
    it(`strikes: "${text}"`, () => {
      const result = label(slug, text);
      assert.equal(result.strike !== null, true, `expected a strike, got ${JSON.stringify(result)}`);
      void id;
    });
  }

  const hits: [string, string, CriterionId, string[]?][] = [
    ["jordan", "Landed weird how? Was it the joke itself or that it happened in front of people?", "C1"],
    ["sofia", "That makes complete sense. You trusted me with something painful and I made you relive it in front of strangers. Of course you're hurt.", "C2"],
    ["jordan", "That makes sense. I'm really sorry, Jordan. I wasn't paying attention to what was going on for you. Is there anything you'd want me to do differently next time we're out?", "C3"],
    ["marcus", "I'm sorry, Marcus. Are there other things you'd rather I never joke about, so I don't do this again?", "C3"],
    ["priya", "That's fair, and I'm sorry. Next time you need to leave, I'll walk you out and just tell people you've got a big exam. Would that help?", "C3"],
    [
      "dev",
      "I understand. I won't push. Whenever you're ready to talk, I'll be here.",
      "C3",
      ["I'm sorry, Dev. I messaged the person who posted it and asked them to take it down, and I'll tell the guys on the team it was a cheap shot on my part."],
    ],
  ];
  for (const [slug, text, id, earlier] of hits) {
    it(`meets ${id}: "${text.slice(0, 60)}…"`, () => {
      const result = label(slug, text, earlier);
      assert.equal(result.strike, null, JSON.stringify(result));
      assert.ok(result.met.includes(id), JSON.stringify(result));
    });
  }

  it("does not credit Dev's C3 without the repair step", () => {
    const result = label("dev", "I understand. I won't push. Whenever you're ready to talk, I'll be here.", ["I'm sorry, Dev."]);
    assert.equal(result.met.includes("C3"), false);
  });

  it("leaves small talk neutral", () => {
    const result = label("marcus", "Your haircut is fair game. Got it.");
    assert.deepEqual(result.met, []);
    assert.equal(result.strike, null);
  });
});

describe("model label parsing", () => {
  it("drops credit on a strike turn", () => {
    assert.deepEqual(parseLabel({ met: ["C1"], strike: "C2", note: "x" }, jordan), { met: [], strike: "C2", note: "x", source: "live" });
  });

  it("ignores unknown criteria and normalizes case", () => {
    assert.deepEqual(parseLabel({ met: ["c1", "C9"], strike: null }, jordan)?.met, ["C1"]);
  });

  it("rejects unusable output", () => {
    assert.equal(parseLabel(null, jordan), null);
    assert.equal(parseLabel({ hello: "there" }, jordan), null);
  });
});
