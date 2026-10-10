import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  compareLeaderboardRows,
  compareSummaryRows,
  countOwnWhite,
  isLeaderboardLevel,
  isLeaderboardPlayerCount,
  leaderboardScore,
  qualifiesForLeaderboard,
  rankAmongSorted,
} from "./leaderboard";

describe("leaderboard scoring", () => {
  it("solo score is own_queries only", () => {
    assert.equal(leaderboardScore(1, { ownQueries: 7, greenCount: 9, ownWhiteCount: 4 }), 7);
  });

  it("multi score sums queries + green + own white", () => {
    assert.equal(leaderboardScore(2, { ownQueries: 3, greenCount: 5, ownWhiteCount: 2 }), 10);
    assert.equal(leaderboardScore(3, { ownQueries: 1, greenCount: 0, ownWhiteCount: 0 }), 1);
    assert.equal(leaderboardScore(4, { ownQueries: 2, greenCount: 2, ownWhiteCount: 1 }), 5);
  });

  it("counts only non-empty white windows", () => {
    assert.equal(countOwnWhite(["A", "—", "", "  ", "3", null, undefined]), 2);
  });
});

describe("leaderboard eligibility", () => {
  it("only first-clear wins on levels 1–15", () => {
    assert.equal(qualifiesForLeaderboard({ result: "win", isFirstClear: true, level: 1 }), true);
    assert.equal(qualifiesForLeaderboard({ result: "win", isFirstClear: true, level: 15 }), true);
    assert.equal(qualifiesForLeaderboard({ result: "win", isFirstClear: false, level: 1 }), false);
    assert.equal(qualifiesForLeaderboard({ result: "lose", isFirstClear: true, level: 1 }), false);
    assert.equal(qualifiesForLeaderboard({ result: "win", isFirstClear: true, level: 0 }), false);
    assert.equal(qualifiesForLeaderboard({ result: "win", isFirstClear: true, level: 16 }), false);
  });

  it("prologue and invalid player counts are rejected", () => {
    assert.equal(isLeaderboardLevel(0), false);
    assert.equal(isLeaderboardPlayerCount(0), false);
    assert.equal(isLeaderboardPlayerCount(5), false);
    assert.equal(isLeaderboardPlayerCount(2), true);
  });
});

describe("leaderboard ordering", () => {
  it("ties break by earlier played_at", () => {
    const a = { score: 5, playedAt: 100, id: 2 };
    const b = { score: 5, playedAt: 90, id: 1 };
    const c = { score: 4, playedAt: 200, id: 3 };
    const sorted = [a, b, c].sort(compareLeaderboardRows);
    assert.deepEqual(
      sorted.map((r) => r.id),
      [3, 1, 2]
    );
  });

  it("summary prefers more clears, then lower score sum, then earlier last clear", () => {
    const rows = [
      { clears: 2, scoreSum: 10, lastPlayedAt: 50, userId: 1 },
      { clears: 3, scoreSum: 20, lastPlayedAt: 80, userId: 2 },
      { clears: 3, scoreSum: 15, lastPlayedAt: 90, userId: 3 },
      { clears: 3, scoreSum: 15, lastPlayedAt: 70, userId: 4 },
    ].sort(compareSummaryRows);
    assert.deepEqual(
      rows.map((r) => r.userId),
      [4, 3, 2, 1]
    );
  });

  it("rankAmongSorted returns 1-based place including ties broken by cmp", () => {
    const sorted = [
      { score: 3, playedAt: 10, id: 1 },
      { score: 5, playedAt: 20, id: 2 },
      { score: 5, playedAt: 30, id: 3 },
    ];
    const me = { score: 5, playedAt: 25, id: 9 };
    // one better by score, one better by earlier time → rank 3
    assert.equal(rankAmongSorted(sorted, me, compareLeaderboardRows), 3);
    assert.equal(rankAmongSorted(sorted, sorted[0], compareLeaderboardRows), 1);
    assert.equal(rankAmongSorted(sorted, null, compareLeaderboardRows), null);
  });
});

describe("boards split by player count", () => {
  it("same level first clears land on different boards by player_count", () => {
    const entries = [
      { userId: 1, level: 3, playerCount: 1, score: 4, playedAt: 10 },
      { userId: 2, level: 3, playerCount: 2, score: 4, playedAt: 10 },
      { userId: 3, level: 3, playerCount: 1, score: 6, playedAt: 5 },
    ];
    const solo = entries
      .filter((e) => e.playerCount === 1)
      .sort(compareLeaderboardRows);
    const duo = entries
      .filter((e) => e.playerCount === 2)
      .sort(compareLeaderboardRows);
    assert.deepEqual(
      solo.map((e) => e.userId),
      [1, 3]
    );
    assert.deepEqual(
      duo.map((e) => e.userId),
      [2]
    );
  });
});
