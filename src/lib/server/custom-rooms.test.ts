import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCustomRequest } from "@/lib/game/custom-level";
import { ensureCustomLevel } from "./custom-levels";
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
