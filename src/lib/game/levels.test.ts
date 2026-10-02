import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { levelLabel, migrateClearedTier, orderByDifficulty, suggestLevel } from "./levels";
import { listLevels, pickScenarioIdForLevel, getScenarioBundle } from "./scenarios";

describe("levels", () => {
  it("orders by min queries, keeping bank order within a tier", () => {
    const out = orderByDifficulty([
      { id: "a", greedySteps: 7 },
      { id: "b", greedySteps: 5 },
      { id: "c", greedySteps: 7 },
      { id: "d", greedySteps: 5 },
    ]);
    assert.deepEqual(out.map((x) => x.id), ["b", "d", "a", "c"]);
  });

  it("numbers the bank 1…15 with non-decreasing difficulty", () => {
    const levels = listLevels();
    assert.equal(levels.length, 15);
    levels.forEach((l, i) => assert.equal(l.level, i + 1));
    for (let i = 1; i < levels.length; i++) {
      assert.ok(levels[i].greedyMin >= levels[i - 1].greedyMin);
    }
  });

  it("each level maps to a scenario carrying its label", () => {
    for (const l of listLevels()) {
      const pub = getScenarioBundle(pickScenarioIdForLevel(l.level))!.public;
      assert.equal(pub.level, l.level);
      assert.equal(pub.tier, levelLabel(l.level));
    }
    assert.throws(() => pickScenarioIdForLevel(16));
  });

  it("suggests the next level to play", () => {
    const levels = listLevels();
    assert.equal(suggestLevel(levels, new Set()), 1);
    assert.equal(suggestLevel(levels, new Set([1, 2, 3])), 4);
    assert.equal(suggestLevel(levels, new Set([5])), 6);
    const all = new Set(levels.map((l) => l.level));
    assert.equal(suggestLevel(levels, all), 1);
    all.delete(2);
    assert.equal(suggestLevel(levels, all), 2);
  });

  it("migrates old tier progress", () => {
    const levels = listLevels();
    assert.deepEqual(migrateClearedTier(levels, 0), []);
    assert.deepEqual(migrateClearedTier(levels, 6), [1, 2, 3, 4, 5, 6]);
  });
});
