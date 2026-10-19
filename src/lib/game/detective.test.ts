import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DETECTIVE_CASES,
  DETECTIVE_MIN_GAMES,
  DETECTIVE_NODE_MAX,
  DETECTIVE_NODE_MIN,
  aggregateDetective,
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

  it("ranks win rate first, then green, white, asks", () => {
    const rows = [
      s(1, { wins: 2 }),
      s(2, { wins: 3 }),
      s(3, { wins: 2, greenSum: 16 }),
      s(4, { wins: 2, greenSum: 16, whiteSum: 4 }),
      s(5, { wins: 2, greenSum: 16, whiteSum: 4, querySum: 8 }),
    ].sort(compareDetectiveStats);
    assert.deepEqual(rows.map((r) => r.userId), [2, 5, 4, 3, 1]);
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
