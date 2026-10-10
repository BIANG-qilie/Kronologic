import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { openTestDb } from "./test-db";
import { setDb, type Db } from "./db";
import { createUser } from "./auth/accounts";
import { recordGameResult } from "./records";
import { getLevelLeaderboard, getSummaryLeaderboard } from "./leaderboard";

async function win(
  db: Db,
  userId: number,
  opts: {
    level: number;
    playerCount: number;
    ownQueries: number;
    greenCount?: number;
    ownWhiteCount?: number;
    playedAt: Date;
    firstClear?: boolean;
  }
) {
  const greenCount = opts.greenCount ?? 0;
  const ownWhiteCount = opts.ownWhiteCount ?? 0;
  await recordGameResult(db, {
    userId,
    caseId: `case-${opts.level}-${opts.playerCount}`,
    level: opts.level,
    mode: opts.playerCount === 1 ? "solo" : "multi",
    result: "win",
    queriesUsed: opts.ownQueries,
    minQueries: 3,
    firstToSubmit: true,
    msAfterFirstSubmit: null,
    playerCount: opts.playerCount,
    ownQueries: opts.ownQueries,
    greenCount,
    ownWhiteCount,
    playedAt: opts.playedAt,
  });
}

describe("leaderboard queries", () => {
  let db: Db;
  let close: () => Promise<void>;
  before(async () => {
    ({ db, close } = await openTestDb());
    setDb(db);
  });
  after(async () => {
    setDb(null);
    await close();
  });

  it("level board: first clear only, split by players, tie-break by time", async () => {
    const a = await createUser(db, "榜甲", "lamp-board-1");
    const b = await createUser(db, "榜乙", "lamp-board-2");
    const c = await createUser(db, "榜丙", "lamp-board-3");

    await win(db, a.id, { level: 2, playerCount: 1, ownQueries: 5, playedAt: new Date("2026-02-01T10:00:00Z") });
    await win(db, b.id, { level: 2, playerCount: 1, ownQueries: 5, playedAt: new Date("2026-02-01T09:00:00Z") });
    await win(db, c.id, {
      level: 2,
      playerCount: 2,
      ownQueries: 2,
      greenCount: 3,
      ownWhiteCount: 1,
      playedAt: new Date("2026-02-01T08:00:00Z"),
    });
    // second clear of level 2 for a — must not change first-clear board
    await recordGameResult(db, {
      userId: a.id,
      caseId: "case-2-again",
      level: 2,
      mode: "solo",
      result: "win",
      queriesUsed: 1,
      minQueries: 3,
      firstToSubmit: true,
      msAfterFirstSubmit: null,
      playerCount: 1,
      ownQueries: 1,
      greenCount: 0,
      ownWhiteCount: 0,
      playedAt: new Date("2026-02-02T10:00:00Z"),
    });
    // prologue never ranks
    await recordGameResult(db, {
      userId: a.id,
      caseId: "prologue",
      level: 0,
      mode: "solo",
      result: "win",
      queriesUsed: 0,
      minQueries: 0,
      firstToSubmit: true,
      msAfterFirstSubmit: null,
      playerCount: 1,
      ownQueries: 0,
      greenCount: 0,
      ownWhiteCount: 0,
      playedAt: new Date("2026-02-01T07:00:00Z"),
    });

    const solo = await getLevelLeaderboard(db, 2, 1, a.id);
    assert.equal(solo.top.length, 2);
    assert.equal(solo.top[0].username, "榜乙");
    assert.equal(solo.top[1].username, "榜甲");
    assert.equal(solo.top[0].score, 5);
    assert.equal(solo.me?.rank, 2);
    assert.equal(solo.me?.score, 5);

    const duo = await getLevelLeaderboard(db, 2, 2, c.id);
    assert.equal(duo.top.length, 1);
    assert.equal(duo.top[0].score, 6); // 2+3+1
    assert.equal(duo.me?.rank, 1);
  });

  it("summary board: clears first, then score sum, then earlier last clear", async () => {
    const x = await createUser(db, "总榜X", "lamp-board-4");
    const y = await createUser(db, "总榜Y", "lamp-board-5");
    await win(db, x.id, { level: 4, playerCount: 1, ownQueries: 4, playedAt: new Date("2026-03-01T10:00:00Z") });
    await win(db, x.id, { level: 5, playerCount: 1, ownQueries: 6, playedAt: new Date("2026-03-02T10:00:00Z") });
    await win(db, y.id, { level: 4, playerCount: 1, ownQueries: 3, playedAt: new Date("2026-03-01T09:00:00Z") });
    await win(db, y.id, { level: 5, playerCount: 1, ownQueries: 7, playedAt: new Date("2026-03-01T12:00:00Z") });

    const board = await getSummaryLeaderboard(db, 1, y.id);
    const names = board.top.map((r) => r.username);
    assert.ok(names.includes("总榜X"));
    assert.ok(names.includes("总榜Y"));
    const xRow = board.top.find((r) => r.username === "总榜X")!;
    const yRow = board.top.find((r) => r.username === "总榜Y")!;
    assert.equal(xRow.clears, 2);
    assert.equal(yRow.clears, 2);
    assert.equal(xRow.scoreSum, 10);
    assert.equal(yRow.scoreSum, 10);
    // same clears + score sum → earlier max(played_at) wins
    assert.ok(yRow.rank < xRow.rank);
    assert.equal(board.me?.username, "总榜Y");
  });
});
