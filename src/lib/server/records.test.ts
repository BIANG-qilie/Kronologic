import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { openTestDb } from "./test-db";
import { setDb, type Db } from "./db";
import { achievements, gameRecords } from "./db/schema";
import { authenticate, createSession, createUser, resolveSession } from "./auth/accounts";
import { askQuery, createRoom, getRoom, joinRoom, startGame, submitAnswers } from "./rooms";
import { clearedLevels, getProfile, recordGameResult } from "./records";
import { listLevels, pickScenarioIdForLevel } from "@/lib/game/scenarios";

async function codesOf(db: Db, userId: number) {
  const rows = await db.select().from(achievements).where(eq(achievements.userId, userId));
  return rows.map((r) => r.code).sort();
}

function correctAnswers(code: string) {
  return { ...getRoom(code)!.sealed!.answers };
}

function wrongAnswers(code: string) {
  const answers = correctAnswers(code);
  const room = getRoom(code)!;
  const q = room.scenario.winQuestions.find((x) => x.kind === "time")!;
  answers[q.id] = String((Number(answers[q.id]) % 6) + 1);
  return answers;
}

describe("game records (integration)", () => {
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

  it("register → login → solo game writes a record, first clear and achievements", async () => {
    await createUser(db, "夜班侦探", "lamp-order-1");
    const user = await authenticate(db, "夜班侦探", "lamp-order-1");
    assert.ok(user);
    const { token: cookie } = await createSession(db, user.id);
    const signedIn = await resolveSession(db, cookie);
    assert.equal(signedIn?.id, user.id);

    const { room, token } = createRoom("夜班侦探", pickScenarioIdForLevel(1), signedIn!.id);
    startGame(room.code, token);
    const seat = room.players[0];
    outer: for (const p of room.scenario.places) {
      for (const t of [1, 2, 3, 4, 5, 6] as const) {
        if (seat.queryCount > room.scenario.greedyMin!) break outer;
        askQuery(room.code, token, { kind: "place_time", placeId: p.id, timeId: t });
      }
    }
    assert.ok(seat.queryCount > room.scenario.greedyMin!);
    submitAnswers(room.code, token, correctAnswers(room.code));
    assert.equal(room.phase, "reveal");
    assert.deepEqual(room.players[0].record, { status: "pending" });
    await room.recording;

    const record = room.players[0].record;
    assert.equal(record?.status, "saved");
    if (record?.status !== "saved") return;
    assert.equal(record.result, "win");
    assert.equal(record.isFirstClear, true);
    assert.equal(record.bestQueries, record.queriesUsed);
    assert.ok(record.newAchievements.includes("debut"));
    assert.ok(record.newAchievements.includes("first_win"));
    assert.ok(!record.newAchievements.includes("perfect"));

    const rows = await db.select().from(gameRecords).where(eq(gameRecords.userId, user.id));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].level, 1);
    assert.equal(rows[0].mode, "solo");
    assert.equal(rows[0].caseId, room.scenarioId);
    assert.equal(rows[0].minQueries, room.scenario.greedyMin);
    assert.deepEqual(await clearedLevels(db, user.id), [1]);

    const again = createRoom("夜班侦探", pickScenarioIdForLevel(1), user.id);
    startGame(again.room.code, again.token);
    submitAnswers(again.room.code, again.token, correctAnswers(again.room.code));
    await again.room.recording;
    const second = again.room.players[0].record;
    assert.equal(second?.status === "saved" && second.isFirstClear, false);
    assert.equal(second?.status === "saved" && second.bestQueries, 0);
    assert.ok(second?.status === "saved" && second.newAchievements.includes("perfect"));
  });

  it("guests are never recorded and a lost game still counts", async () => {
    const guest = createRoom("游客", pickScenarioIdForLevel(2));
    startGame(guest.room.code, guest.token);
    submitAnswers(guest.room.code, guest.token, correctAnswers(guest.room.code));
    await guest.room.recording;
    assert.equal(guest.room.players[0].record, null);

    const user = await createUser(db, "unlucky", "lamp-order-2");
    const lost = createRoom("unlucky", pickScenarioIdForLevel(2), user.id);
    startGame(lost.room.code, lost.token);
    submitAnswers(lost.room.code, lost.token, wrongAnswers(lost.room.code));
    assert.equal(lost.room.phase, "all_eliminated");
    await lost.room.recording;
    const r = lost.room.players[0].record;
    assert.equal(r?.status === "saved" && r.result, "eliminated");
    assert.deepEqual(await codesOf(db, user.id), ["debut"]);
  });

  it("multiplayer: first correct submitter is 抢答者, a later correct one is 绝境翻盘", async () => {
    const a = await createUser(db, "抢答甲", "lamp-order-3");
    const b = await createUser(db, "翻盘乙", "lamp-order-4");
    const host = createRoom("甲", pickScenarioIdForLevel(5), a.id);
    const guest = joinRoom(host.room.code, "乙", b.id);
    const spectator = joinRoom(host.room.code, "丙");
    startGame(host.room.code, host.token);
    submitAnswers(host.room.code, host.token, correctAnswers(host.room.code));
    submitAnswers(host.room.code, spectator.token, wrongAnswers(host.room.code));
    submitAnswers(host.room.code, guest.token, correctAnswers(host.room.code));
    assert.equal(host.room.phase, "reveal");
    await host.room.recording;

    assert.deepEqual(await codesOf(db, a.id), ["debut", "first_win", "level_5", "quick_draw"]);
    assert.deepEqual(await codesOf(db, b.id), ["comeback", "debut", "first_win", "level_5"]);
    assert.equal(host.room.players[2].record, null);
    const rows = await db.select().from(gameRecords).where(eq(gameRecords.userId, b.id));
    assert.equal(rows[0].mode, "multi");
  });

  it("灯序大师 after all fifteen levels, and the profile adds it all up", async () => {
    const user = await createUser(db, "master", "lamp-order-5");
    for (const l of listLevels()) {
      await recordGameResult(db, {
        userId: user.id,
        caseId: `case-${l.level}`,
        level: l.level,
        mode: "solo",
        result: "win",
        queriesUsed: l.greedyMin + 2,
        minQueries: l.greedyMin,
        firstToSubmit: true,
        msAfterFirstSubmit: null,
        playedAt: new Date(Date.UTC(2026, 0, l.level)),
      });
    }
    await recordGameResult(db, {
      userId: user.id,
      caseId: "case-3",
      level: 3,
      mode: "multi",
      result: "lose",
      queriesUsed: 4,
      minQueries: 5,
      firstToSubmit: false,
      msAfterFirstSubmit: null,
    });
    const codes = await codesOf(db, user.id);
    assert.ok(codes.includes("all_clear"));
    assert.ok(!codes.includes("perfect"));

    const profile = await getProfile(db, user.id, listLevels());
    assert.ok(profile);
    assert.equal(profile.totals.games, 16);
    assert.equal(profile.totals.wins, 15);
    assert.equal(profile.totals.cleared, 15);
    assert.equal(profile.levels[0].firstClearAt, new Date(Date.UTC(2026, 0, 1)).toISOString());
    assert.equal(profile.levels[0].bestQueries, profile.levels[0].minQueries + 2);
    assert.equal(profile.recent.length, 16);
    assert.equal(profile.recent[0].result, "lose");
  });

  it("a failed write is logged and marks the seat failed without throwing", async () => {
    const user = await createUser(db, "ghost_writer", "lamp-order-6");
    const { room, token } = createRoom("ghost", pickScenarioIdForLevel(1), user.id);
    room.players[0].userId = 999_999;
    startGame(room.code, token);
    const original = console.error;
    console.error = () => undefined;
    try {
      submitAnswers(room.code, token, correctAnswers(room.code));
      await room.recording;
    } finally {
      console.error = original;
    }
    assert.equal(room.phase, "reveal");
    assert.deepEqual(room.players[0].record, { status: "failed" });
  });
});
