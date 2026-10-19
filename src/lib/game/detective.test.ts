import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DETECTIVE_CASES,
  DETECTIVE_MIN_GAMES,
  DETECTIVE_NODE_MAX,
  DETECTIVE_NODE_MIN,
  aggregateDetective,
  canDrawDifficulty,
  evaluateDetectiveAchievements,
  expertUnlock,
  compareDetectiveStats,
  rankDetective,
  rollDetectiveRequest,
  type DetectiveTotals,
} from "./detective";
import { mulberry32 } from "./generate-case";

const t = (userId: number, o: Partial<DetectiveTotals>): DetectiveTotals => ({
  userId,
  username: `u${userId}`,
  games: 4,
  wins: 2,
  greenSum: 20,
  whiteSum: 8,
  querySum: 12,
  ...o,
});

describe("detective aggregation", () => {
  it("averages per game", () => {
    const s = aggregateDetective(t(1, { games: 4, wins: 3, greenSum: 10, whiteSum: 6, querySum: 9 }));
    assert.equal(s.winRate, 0.75);
    assert.equal(s.avgGreen, 2.5);
    assert.equal(s.avgWhite, 1.5);
    assert.equal(s.avgQueries, 2.25);
  });

  it("handles zero games without dividing by zero", () => {
    const s = aggregateDetective(t(1, { games: 0, wins: 0, greenSum: 0, whiteSum: 0, querySum: 0 }));
    assert.equal(s.winRate, 0);
    assert.equal(s.avgGreen, 0);
  });
});

describe("detective comparator", () => {
  const s = (id: number, o: Partial<DetectiveTotals>) => aggregateDetective(t(id, o));

  it("ranks win rate first, then green, asks, white, games", () => {
    const rows = [
      s(1, { wins: 2 }),
      s(2, { wins: 3 }),
      s(3, { wins: 2, greenSum: 16 }),
      s(4, { wins: 2, greenSum: 16, querySum: 8 }),
      s(5, { wins: 2, greenSum: 16, querySum: 8, whiteSum: 4 }),
    ].sort(compareDetectiveStats);
    assert.deepEqual(rows.map((r) => r.userId), [2, 5, 4, 3, 1]);
  });

  it("fewer asks beats fewer white windows", () => {
    const a = s(1, { querySum: 8, whiteSum: 20 });
    const b = s(2, { querySum: 12, whiteSum: 0 });
    assert.ok(compareDetectiveStats(a, b) < 0);
  });

  it("win rate beats fewer windows", () => {
    const a = s(1, { wins: 4, greenSum: 99 });
    const b = s(2, { wins: 3, greenSum: 0 });
    assert.ok(compareDetectiveStats(a, b) < 0);
  });

  it("treats equal rates from different game counts as ties, then prefers more games", () => {
    const a = s(1, { games: 3, wins: 1, greenSum: 3, whiteSum: 3, querySum: 3 });
    const b = s(2, { games: 9, wins: 3, greenSum: 9, whiteSum: 9, querySum: 9 });
    assert.ok(compareDetectiveStats(b, a) < 0);
  });
});

describe("detective ranking", () => {
  it("keeps players below the threshold off the board but still reports them", () => {
    const board = rankDetective(
      [t(1, { games: 1, wins: 1 }), t(2, { games: DETECTIVE_MIN_GAMES, wins: 1 })],
      1
    );
    assert.deepEqual(board.ranked.map((r) => r.userId), [2]);
    assert.equal(board.ranked[0].rank, 1);
    assert.equal(board.me?.userId, 1);
    assert.equal(board.me?.rank, null);
  });

  it("gives the viewer their rank when eligible", () => {
    const board = rankDetective([t(1, { wins: 1 }), t(2, { wins: 4 })], 1);
    assert.equal(board.me?.rank, 2);
  });
});

describe("detective draw", () => {
  it("stays inside the case list and node range", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const r = rollDetectiveRequest("normal", rng, "S");
      assert.ok(DETECTIVE_CASES.some((c) => c.id === r.caseId));
      assert.ok(r.nodeCount >= DETECTIVE_NODE_MIN && r.nodeCount <= DETECTIVE_NODE_MAX);
      assert.equal(r.difficulty, "normal");
      assert.equal(r.oneWayCount, null);
    }
  });
});

describe("detective achievements and unlock", () => {
  const base = { difficulty: "normal" as const, result: "win" as const, rating: "silver" as const, queries: 9, bandMin: 6 };
  const h = (o: Partial<{ wins: number; hardGolds: number; unlocked: Set<string> }> = {}) => ({
    wins: 1,
    hardGolds: 0,
    unlocked: new Set<string>(),
    ...o,
  });

  it("first night needs a win, not a loss", () => {
    assert.deepEqual(evaluateDetectiveAchievements(base, h()), ["detective_first_night"]);
    assert.deepEqual(evaluateDetectiveAchievements({ ...base, result: "lose", rating: null }, h({ wins: 0 })), []);
  });

  it("never repeats an unlocked achievement", () => {
    assert.deepEqual(evaluateDetectiveAchievements(base, h({ unlocked: new Set(["detective_first_night"]) })), []);
  });

  it("gold three at three hard golds, same count as the expert unlock", () => {
    assert.ok(!evaluateDetectiveAchievements(base, h({ hardGolds: 2 })).includes("detective_gold_three"));
    assert.ok(evaluateDetectiveAchievements(base, h({ hardGolds: 3 })).includes("detective_gold_three"));
    assert.equal(expertUnlock(2).remaining, 1);
    assert.ok(!canDrawDifficulty("expert", expertUnlock(2)));
    assert.ok(canDrawDifficulty("expert", expertUnlock(3)));
    assert.ok(canDrawDifficulty("hard", expertUnlock(0)));
  });

  it("expert needs a win on expert", () => {
    assert.ok(evaluateDetectiveAchievements({ ...base, difficulty: "expert" }, h()).includes("detective_expert"));
    assert.ok(!evaluateDetectiveAchievements({ ...base, difficulty: "hard" }, h()).includes("detective_expert"));
    assert.ok(
      !evaluateDetectiveAchievements({ ...base, difficulty: "expert", result: "eliminated", rating: null }, h()).includes(
        "detective_expert"
      )
    );
  });

  it("terse uses the recorded band floor, else the default", () => {
    assert.ok(evaluateDetectiveAchievements({ ...base, queries: 6 }, h()).includes("detective_terse"));
    assert.ok(!evaluateDetectiveAchievements({ ...base, queries: 7 }, h()).includes("detective_terse"));
    assert.ok(evaluateDetectiveAchievements({ ...base, difficulty: "hard", queries: 8, bandMin: null }, h()).includes("detective_terse"));
    assert.ok(!evaluateDetectiveAchievements({ ...base, difficulty: "easy", queries: 5, bandMin: null }, h()).includes("detective_terse"));
    assert.ok(!evaluateDetectiveAchievements({ ...base, queries: 3, result: "lose", rating: null }, h()).includes("detective_terse"));
  });

  it("regular at ten wins", () => {
    assert.ok(!evaluateDetectiveAchievements(base, h({ wins: 9 })).includes("detective_regular"));
    assert.ok(evaluateDetectiveAchievements(base, h({ wins: 10 })).includes("detective_regular"));
  });
});
