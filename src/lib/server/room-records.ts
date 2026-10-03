import { getDb } from "@/lib/server/db";
import { recordGameResult, type GameRecordInput } from "@/lib/server/records";
import type { InternalPlayer, InternalRoom } from "@/lib/server/rooms";

export function seatOutcome(room: InternalRoom, p: InternalPlayer, userId: number): GameRecordInput {
  const first = room.firstSubmitterId === p.id;
  return {
    userId,
    caseId: room.scenarioId,
    level: room.scenario.level ?? 0,
    mode: room.players.length === 1 ? "solo" : "multi",
    result: room.winners.includes(p.id) ? "win" : p.eliminated ? "eliminated" : "lose",
    queriesUsed: p.queryCount,
    minQueries: room.scenario.greedyMin ?? 0,
    firstToSubmit: first,
    msAfterFirstSubmit:
      !first && p.submittedAt != null && room.windowOpenedAt != null
        ? p.submittedAt - room.windowOpenedAt
        : null,
  };
}

/** Write failures are logged and shown as nothing; they never block the results screen. */
export async function recordRoomResults(room: InternalRoom, onChange: () => void): Promise<void> {
  const seats = room.players.filter((p): p is InternalPlayer & { userId: number } => p.userId != null);
  if (!seats.length) return;
  for (const p of seats) p.record = { status: "pending" };

  let db;
  try {
    db = await getDb();
  } catch (e) {
    console.error("records: database unavailable", e);
  }
  if (!db) {
    for (const p of seats) p.record = { status: "failed" };
    onChange();
    return;
  }

  await Promise.all(
    seats.map(async (p) => {
      try {
        p.record = await recordGameResult(db, seatOutcome(room, p, p.userId));
      } catch (e) {
        console.error(`records: write failed for user ${p.userId}`, e);
        p.record = { status: "failed" };
      }
    })
  );
  onChange();
}
