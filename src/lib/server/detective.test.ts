import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { openTestDb } from "./test-db";
import { setDb, type Db } from "./db";
import { createUser } from "./auth/accounts";
import {
  DetectiveAuthError,
  assertDetectivePlayer,
  getDetectiveLeaderboard,
  recordDetectiveResult,
  type DetectiveRecordInput,
} from "./detective";
import { createRoom, joinRoom, setScenario, startGame, submitAnswers } from "./rooms";
import { ensureCustomLevel } from "./custom-levels";
import { customLevelId, parseCustomRequest } from "@/lib/game/custom-level";
import { getDefaultScenarioId } from "@/lib/game/scenarios";

describe("detective permissions", () => {
  it("refuses guests", () => {
    assert.throws(() => assertDetectivePlayer(null), DetectiveAuthError);
    assert.equal(assertDetectivePlayer({ id: 3, username: "侦探" }).id, 3);
  });

  it("guests cannot join a detective room and the case cannot be swapped", async () => {
    const req = parseCustomRequest({ nodeCount: 6, difficulty: "easy", seed: "DT1" });
    const bundle = await ensureCustomLevel(req);
    const { room, token } = createRoom("侦探", undefined, 1, bundle, {
      caseId: "night-tea",
      difficulty: "easy",
      levelId: customLevelId(req),
    });
    assert.throws(() => joinRoom(room.code, "路人", null), DetectiveAuthError);
    joinRoom(room.code, "同伴", 2);
    assert.throws(() => setScenario(room.code, token, getDefaultScenarioId()), /不能换/);
  });
});

describe("detective records", () => {
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

  const rec = (userId: number, o: Partial<DetectiveRecordInput>): DetectiveRecordInput => ({
    userId,
    caseId: "night-tea",
    difficulty: "normal",
    levelId: "x",
    playerCount: 1,
    result: "win",
    greenCount: 5,
    whiteCount: 2,
    queries: 5,
    ...o,
  });

  it("aggregates, filters and applies the games threshold", async () => {
    const a = await createUser(db, "探甲", "lamp-det-1");
    const b = await createUser(db, "探乙", "lamp-det-2");
    const c = await createUser(db, "探丙", "lamp-det-3");
    for (let i = 0; i < 3; i++) await recordDetectiveResult(db, rec(a.id, { greenCount: 4 }));
    for (let i = 0; i < 3; i++) await recordDetectiveResult(db, rec(b.id, { result: i ? "win" : "lose" }));
    await recordDetectiveResult(db, rec(c.id, {}));
    for (let i = 0; i < 3; i++) await recordDetectiveResult(db, rec(c.id, { difficulty: "hard" }));

    const all = await getDetectiveLeaderboard(db, {}, c.id);
    assert.deepEqual(all.ranked.map((r) => r.username), ["探甲", "探丙", "探乙"]);
    assert.equal(all.ranked[0].avgGreen, 4);

    const normal = await getDetectiveLeaderboard(db, { difficulty: "normal" }, c.id);
    assert.deepEqual(normal.ranked.map((r) => r.username), ["探甲", "探乙"]);
    assert.equal(normal.me?.games, 1);
    assert.equal(normal.me?.rank, null);
    assert.ok(Math.abs(normal.ranked[1].winRate - 2 / 3) < 1e-9);

    const hard = await getDetectiveLeaderboard(db, { difficulty: "hard", caseId: "night-tea" }, null);
    assert.deepEqual(hard.ranked.map((r) => r.username), ["探丙"]);
  });

  it("a finished detective room writes detective rows, not level records", async () => {
    const u = await createUser(db, "探丁", "lamp-det-4");
    const req = parseCustomRequest({ nodeCount: 6, difficulty: "easy", seed: "DT2" });
    const bundle = await ensureCustomLevel(req);
    const { room, token } = createRoom(u.username, undefined, u.id, bundle, {
      caseId: "night-tea",
      difficulty: "easy",
      levelId: customLevelId(req),
    });
    startGame(room.code, token);
    const answers = Object.fromEntries(room.scenario.winQuestions.map((q) => [q.id, bundle.sealed.answers[q.id]]));
    submitAnswers(room.code, token, answers);
    await room.recording;
    const board = await getDetectiveLeaderboard(db, { difficulty: "easy" }, u.id);
    assert.equal(board.me?.games, 1);
    assert.equal(board.me?.wins, 1);
  });
});
