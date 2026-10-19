import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { openTestDb } from "./test-db";
import { setDb, type Db } from "./db";
import { createUser } from "./auth/accounts";
import {
  DetectiveAuthError,
  assertDetectivePlayer,
  getDetectiveLeaderboard,
  getExpertUnlock,
  recordDetectiveResult,
  type DetectiveRecordInput,
} from "./detective";
import { createRoom, joinRoom, setScenario, startGame, submitAnswers } from "./rooms";
import { ensureCustomLevel } from "./custom-levels";
import { customLevelId, parseCustomRequest } from "@/lib/game/custom-level";
import { getDefaultScenarioId } from "@/lib/game/scenarios";
import { getProfile } from "./records";
import { getLevelLeaderboard, getSummaryLeaderboard } from "./leaderboard";
import { listLevels } from "@/lib/game/scenarios";

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

  it("unlocks expert and writes achievements once, from hard golds", async () => {
    const u = await createUser(db, "探戊", "lamp-det-5");
    const first = await recordDetectiveResult(db, rec(u.id, { difficulty: "hard", rating: "gold", queries: 12, bandMin: 8 }));
    assert.deepEqual(first, ["detective_first_night"]);
    await recordDetectiveResult(db, rec(u.id, { difficulty: "hard", rating: "silver", queries: 12 }));
    await recordDetectiveResult(db, rec(u.id, { difficulty: "normal", rating: "gold", queries: 12 }));
    await recordDetectiveResult(db, rec(u.id, { difficulty: "hard", result: "lose", rating: null }));
    assert.equal((await getExpertUnlock(db, u.id)).remaining, 2);
    await recordDetectiveResult(db, rec(u.id, { difficulty: "hard", rating: "gold", queries: 12 }));
    const third = await recordDetectiveResult(db, rec(u.id, { difficulty: "hard", rating: "gold", queries: 12 }));
    assert.deepEqual(third, ["detective_gold_three"]);
    assert.ok((await getExpertUnlock(db, u.id)).unlocked);
    const again = await recordDetectiveResult(db, rec(u.id, { difficulty: "hard", rating: "gold", queries: 12 }));
    assert.deepEqual(again, []);
    const terse = await recordDetectiveResult(db, rec(u.id, { difficulty: "expert", rating: "gold", queries: 10, bandMin: 10 }));
    assert.deepEqual(terse, ["detective_expert", "detective_terse"]);
  });

  it("custom levels land in personal history but never on the boards", async () => {
    const u = await createUser(db, "自定客", "lamp-det-6");
    const req = parseCustomRequest({ nodeCount: 6, difficulty: "easy", seed: "CR1" });
    const bundle = await ensureCustomLevel(req);
    const { room, token } = createRoom(u.username, undefined, u.id, bundle);
    startGame(room.code, token);
    const answers = Object.fromEntries(room.scenario.winQuestions.map((q) => [q.id, bundle.sealed.answers[q.id]]));
    submitAnswers(room.code, token, answers);
    await room.recording;
    assert.equal(room.players[0].record?.status, "saved");
    const profile = await getProfile(db, u.id, listLevels());
    assert.equal(profile?.recent.length, 1);
    assert.equal(profile?.recent[0].kind, "custom");
    assert.equal(profile?.recent[0].isFirstClear, false);
    assert.match(profile?.recent[0].customLabel ?? "", /夜茶的毒.*6 地点.*#CR1/);
    assert.equal(profile?.totals.cleared, 0);
    const summary = await getSummaryLeaderboard(db, 1, u.id);
    assert.equal(summary.me, null);
    for (let level = 1; level <= 15; level++) {
      const board = await getLevelLeaderboard(db, level, 1, u.id);
      assert.equal(board.me, null);
    }
    const before = await getDetectiveLeaderboard(db, {}, u.id);
    assert.equal(before.me, null);
  });

  it("detective and custom games both show in recent history, newest first", async () => {
    const u = await createUser(db, "混合客", "lamp-det-7");
    await recordDetectiveResult(db, rec(u.id, { difficulty: "hard", result: "lose", queries: 9, playedAt: new Date("2026-03-01T10:00:00Z") }));
    const req = parseCustomRequest({ nodeCount: 6, difficulty: "easy", seed: "CR2" });
    const bundle = await ensureCustomLevel(req);
    const { room, token } = createRoom(u.username, undefined, u.id, bundle);
    startGame(room.code, token);
    submitAnswers(room.code, token, Object.fromEntries(room.scenario.winQuestions.map((q) => [q.id, bundle.sealed.answers[q.id]])));
    await room.recording;
    const recent = (await getProfile(db, u.id, listLevels()))!.recent;
    assert.deepEqual(recent.map((r) => r.kind), ["custom", "detective"]);
    const det = recent[1];
    assert.equal(det.result, "lose");
    assert.equal(det.queriesUsed, 9);
    assert.equal(det.isFirstClear, false);
    assert.equal(det.customLabel, "《夜茶的毒》 · 烧脑");
    assert.match(recent[0].customLabel ?? "", /《夜茶的毒》 · 6 地点 · 入门.*#CR2/);
  });
});
