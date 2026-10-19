import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CustomLevelAborted, customLevelId, parseCustomRequest } from "@/lib/game/custom-level";
import { customLevelCacheHas, customLevelJobCount, ensureCustomLevel } from "./custom-levels";
import { createRoom, joinRoom, projectRoom, startGame, submitAnswers } from "./rooms";
import { recordRoomResults } from "./room-records";

describe("custom-level rooms", () => {
  const req = parseCustomRequest({ nodeCount: 6, difficulty: "easy", oneWay: true, stay: true, seed: "T2" });

  it("caches a generated level by request", async () => {
    const a = await ensureCustomLevel(req);
    const b = await ensureCustomLevel(req);
    assert.equal(a, b);
  });

  it("plays a custom level end to end without touching records", async () => {
    const bundle = await ensureCustomLevel(req);
    const { room, token } = createRoom("房主", undefined, 1, bundle);
    joinRoom(room.code, "同伴", 2);
    assert.equal(room.scenario.custom?.request.seed, "T2");
    assert.deepEqual(projectRoom(room, token).scenario.custom, bundle.public.custom);

    startGame(room.code, token);
    assert.deepEqual(room.sealed, bundle.sealed);

    const answers = Object.fromEntries(
      room.scenario.winQuestions.map((q) => [q.id, bundle.sealed.answers[q.id]])
    );
    submitAnswers(room.code, token, answers);
    const guest = room.players[1];
    submitAnswers(room.code, guest.token, answers);
    assert.equal(room.phase, "reveal");
    assert.ok(room.winners.includes(room.players[0].id));

    await recordRoomResults(room, () => {});
    for (const p of room.players) assert.equal(p.record, null);
  });
});

describe("cancelling a shared custom-level job", () => {
  it("keeps going while anyone still waits", async () => {
    const req = parseCustomRequest({ nodeCount: 7, difficulty: "easy", oneWay: true, stay: true, seed: "SHARE1" });
    const leaver = new AbortController();
    const a = ensureCustomLevel(req, leaver.signal);
    const b = ensureCustomLevel(req, new AbortController().signal);
    leaver.abort();
    await assert.rejects(a, (e: unknown) => e instanceof CustomLevelAborted);
    const bundle = await b;
    assert.equal(bundle.public.id, customLevelId(req));
    assert.ok(customLevelCacheHas(customLevelId(req)));
  });

  it("stops the search and caches nothing once every waiter has left", async () => {
    const req = parseCustomRequest({ nodeCount: 6, difficulty: "expert", oneWay: true, stay: true, seed: "T3" });
    const id = customLevelId(req);
    let screens = 0;
    const first = new AbortController();
    const second = new AbortController();
    const a = ensureCustomLevel(req, first.signal, { onScreen: () => screens++ });
    const b = ensureCustomLevel(req, second.signal);
    assert.equal(customLevelJobCount(), 1);

    await new Promise((r) => setTimeout(r, 150));
    first.abort();
    await assert.rejects(a, (e: unknown) => e instanceof CustomLevelAborted);
    assert.equal(customLevelJobCount(), 1, "one waiter left, the search must go on");

    await new Promise((r) => setTimeout(r, 150));
    second.abort();
    await assert.rejects(b, (e: unknown) => e instanceof CustomLevelAborted);
    assert.equal(customLevelJobCount(), 0);

    await new Promise((r) => setTimeout(r, 1500));
    const settled = screens;
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(screens, settled, "search kept running after everyone left");
    assert.ok(!customLevelCacheHas(id));
  });
});
