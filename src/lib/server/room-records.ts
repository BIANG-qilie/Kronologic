import { getDb } from "@/lib/server/db";
import { recordGameResult, type GameRecordInput } from "@/lib/server/records";
import type { InternalPlayer, InternalRoom } from "@/lib/server/rooms";
import { countOwnWhite, leaderboardScore } from "@/lib/game/leaderboard";
import { soloRating } from "@/lib/game/query";
import { bandMinFor } from "@/lib/game/detective";
import { getCustomCase } from "@/lib/game/custom-cases";
import { getCustomDifficulty } from "@/lib/game/custom-level";
import { recordDetectiveResult, type DetectiveRecordInput } from "@/lib/server/detective";

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

export function detectiveOutcome(room: InternalRoom, p: InternalPlayer, userId: number): DetectiveRecordInput {
  const o = seatOutcome(room, p, userId);
  return {
    userId,
    caseId: room.detective!.caseId,
    difficulty: room.detective!.difficulty,
    levelId: room.detective!.levelId,
    playerCount: o.playerCount ?? room.players.length,
    result: o.result,
    rating:
      o.result === "win"
        ? soloRating(p.queryCount, room.scenario.soloBands.goldMax, room.scenario.soloBands.silverMax)
        : null,
    bandMin: bandMinFor(room.detective!.difficulty),
    greenCount: o.greenCount ?? 0,
    whiteCount: o.ownWhiteCount ?? 0,
    queries: o.ownQueries ?? o.queriesUsed,
  };
}

/** One line for personal history: case, map parameters, difficulty and seed. */
export function customRecordLabel(room: InternalRoom): string {
  const c = room.scenario.custom!;
  const r = c.request;
  const caseTitle = getCustomCase(r.caseId)?.title ?? r.caseId;
  const diff = getCustomDifficulty(r.difficulty)?.label ?? r.difficulty;
  const parts = [`《${caseTitle}》`, `${r.nodeCount} 地点`, diff];
  if (c.oneWayCount) parts.push(`单向 ${c.oneWayCount}`);
  if (c.stayCount) parts.push(`停留 ${c.stayCount}`);
  return `${parts.join(" · ")} · #${r.seed}`;
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
        if (room.detective) {
          await recordDetectiveResult(db, detectiveOutcome(room, p, p.userId));
          p.record = null;
        } else {
          const custom = room.scenario.custom;
          p.record = await recordGameResult(db, {
            ...seatOutcome(room, p, p.userId),
            ...(custom ? { customLabel: customRecordLabel(room) } : {}),
          });
        }
      } catch (e) {
        console.error(`records: write failed for user ${p.userId}`, e);
        p.record = { status: "failed" };
      }
    })
  );
  onChange();
}
