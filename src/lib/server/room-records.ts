import { getDb } from "@/lib/server/db";
import { recordGameResult, type GameRecordInput } from "@/lib/server/records";
import type { InternalPlayer, InternalRoom } from "@/lib/server/rooms";
import { countOwnWhite, leaderboardScore } from "@/lib/game/leaderboard";

export function seatOutcome(room: InternalRoom, p: InternalPlayer, userId: number): GameRecordInput {
  const first = room.firstSubmitterId === p.id;
  const playerCount = room.players.length;
  const ownQueries = p.queryCount;
  /** Every in-play ask produces a shared green window; opening facts are not in queryLog. */
  const greenCount = room.queryLog.length;
  const ownWhiteCount = countOwnWhite(p.privateClues.map((c) => c.privateLabel));
  const score = leaderboardScore(playerCount, { ownQueries, greenCount, ownWhiteCount });
  return {
    userId,
    caseId: room.scenarioId,
    level: room.scenario.level ?? 0,
    mode: playerCount === 1 ? "solo" : "multi",
    result: room.winners.includes(p.id) ? "win" : p.eliminated ? "eliminated" : "lose",
    queriesUsed: ownQueries,
    minQueries: room.scenario.greedyMin ?? 0,
    firstToSubmit: first,
    msAfterFirstSubmit:
      !first && p.submittedAt != null && room.windowOpenedAt != null
        ? p.submittedAt - room.windowOpenedAt
        : null,
    playerCount,
    ownQueries,
    greenCount,
    ownWhiteCount,
    score,
  };
}

/** Write failures are logged and shown as nothing; they never block the results screen. */
export async function recordRoomResults(room: InternalRoom, onChange: () => void): Promise<void> {
  // Custom levels are practice: no records, first clears or leaderboard rows.
  if (room.scenario.custom) return;
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
