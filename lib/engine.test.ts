import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectSignals, mirrorFallback, styleProfile } from "./engine";

describe("detectSignals", () => {
  it("does not treat a negated blame as an accusation", () => {
    const signals = detectSignals(
      "It's not your fault. I need the slides by Thursday.",
      ["slides"],
    );
    assert.equal(signals.accusation, 0);
    assert.equal(signals.honesty, 1);
    assert.equal(signals.specific, 1);
  });

  it("hears a defense stuck to an apology", () => {
    const signals = detectSignals("I'm sorry, but it was just a joke.", ["joke"]);
    assert.equal(signals.apology, 1);
    assert.equal(signals.justification, 1);
  });

  it("does not call 'not sorry' an apology", () => {
    const signals = detectSignals("I am not sorry.", []);
    assert.equal(signals.apology, 0);
  });
});

describe("mirror", () => {
  it("rebuilds a mirror line from the player's own words", () => {
    const profile = styleProfile(
      ["You never do your part.", "Help me understand what happened?"],
      [],
    );
    assert.match(profile.summary, /Your voice/);
    assert.equal(mirrorFallback(profile, 0).includes("never") || mirrorFallback(profile, 0).includes("Help"), true);
  });
});
