import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACHIEVEMENTS,
  evaluateAchievements,
  isFirstClear,
  type GameOutcome,
} from "./achievements";

const base: GameOutcome = {
  level: 3,
  mode: "solo",
  result: "win",
  queriesUsed: 9,
  minQueries: 5,
  firstToSubmit: true,
  msAfterFirstSubmit: null,
};
const fresh = { clearedLevels: new Set<number>(), unlocked: new Set<string>() };
const veteran = (cleared: number[]) => ({
  clearedLevels: new Set(cleared),
  unlocked: new Set<string>(["debut", "first_win"]),
});

describe("first clear", () => {
  it("is a first clear only for a win on a level not won before", () => {
    assert.equal(isFirstClear(base, new Set()), true);
    assert.equal(isFirstClear(base, new Set([3])), false);
    assert.equal(isFirstClear({ ...base, result: "eliminated" }, new Set()), false);
    assert.equal(isFirstClear({ ...base, result: "lose" }, new Set([1, 2])), false);
  });
});

describe("achievements", () => {
  it("has seven unique codes", () => {
    assert.equal(ACHIEVEMENTS.length, 7);
    assert.equal(new Set(ACHIEVEMENTS.map((a) => a.code)).size, 7);
  });

  it("初登场 on any finished game, even a loss", () => {
    assert.deepEqual(evaluateAchievements({ ...base, result: "eliminated" }, fresh), ["debut"]);
  });

  it("首胜 on the first win only", () => {
    assert.deepEqual(evaluateAchievements(base, fresh), ["debut", "first_win"]);
    assert.deepEqual(evaluateAchievements(base, veteran([1])), []);
  });

  it("一问不差 needs a solo win within the minimum queries", () => {
    const perfect = { ...base, queriesUsed: 5 };
    assert.ok(evaluateAchievements(perfect, veteran([])).includes("perfect"));
    assert.ok(!evaluateAchievements({ ...perfect, queriesUsed: 6 }, veteran([])).includes("perfect"));
    assert.ok(!evaluateAchievements({ ...perfect, mode: "multi" }, veteran([])).includes("perfect"));
    assert.ok(!evaluateAchievements({ ...perfect, result: "eliminated" }, veteran([])).includes("perfect"));
  });

  it("渐入佳境 when level 5 is cleared", () => {
    assert.deepEqual(evaluateAchievements({ ...base, level: 5 }, veteran([1])), ["level_5"]);
    assert.deepEqual(evaluateAchievements({ ...base, level: 5, result: "lose" }, veteran([1])), []);
  });

  it("灯序大师 when the last missing level falls", () => {
    const fourteen = Array.from({ length: 15 }, (_, i) => i + 1).filter((l) => l !== 9);
    const got = evaluateAchievements({ ...base, level: 9 }, { ...veteran(fourteen), unlocked: new Set(["debut", "first_win", "level_5"]) });
    assert.deepEqual(got, ["all_clear"]);
    assert.deepEqual(evaluateAchievements({ ...base, level: 3 }, veteran(fourteen)), ["level_5"]);
  });

  it("抢答者 for the first correct submitter in multiplayer", () => {
    const multi = { ...base, mode: "multi" as const };
    assert.ok(evaluateAchievements(multi, veteran([])).includes("quick_draw"));
    assert.ok(!evaluateAchievements(base, veteran([])).includes("quick_draw"));
    assert.ok(!evaluateAchievements({ ...multi, result: "eliminated" }, veteran([])).includes("quick_draw"));
  });

  it("绝境翻盘 for a correct answer within 12 s of someone else submitting", () => {
    const late = { ...base, mode: "multi" as const, firstToSubmit: false, msAfterFirstSubmit: 11_900 };
    assert.ok(evaluateAchievements(late, veteran([])).includes("comeback"));
    assert.ok(!evaluateAchievements({ ...late, msAfterFirstSubmit: 12_500 }, veteran([])).includes("comeback"));
    assert.ok(!evaluateAchievements({ ...late, result: "eliminated" }, veteran([])).includes("comeback"));
    assert.ok(!evaluateAchievements({ ...late, firstToSubmit: true }, veteran([])).includes("comeback"));
  });

  it("never re-awards an unlocked achievement", () => {
    const all = new Set<string>(ACHIEVEMENTS.map((a) => a.code));
    assert.deepEqual(evaluateAchievements(base, { clearedLevels: new Set(), unlocked: all }), []);
  });
});
