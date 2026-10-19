import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/server/db";
import { gameRecords, users } from "@/lib/server/db/schema";
import {
  LEADERBOARD_LEVELS,
  LEADERBOARD_TOP,
  compareLeaderboardRows,
  compareSummaryRows,
  isLeaderboardLevel,
  isLeaderboardPlayerCount,
  rankAmongSorted,
  type LeaderboardPlayerCount,
} from "@/lib/game/leaderboard";

export interface LeaderboardRow {
  rank: number;
  userId: number;
  username: string;
  score: number;
  ownQueries: number;
  greenCount: number;
  ownWhiteCount: number;
  playedAt: string;
  level?: number;
}

export interface SummaryRow {
  rank: number;
  userId: number;
  username: string;
  clears: number;
  scoreSum: number;
  lastPlayedAt: string;
}

export interface LevelBoard {
  level: number;
  players: LeaderboardPlayerCount;
  top: LeaderboardRow[];
  me: LeaderboardRow | null;
}

export interface SummaryBoard {
  players: LeaderboardPlayerCount;
  top: SummaryRow[];
  me: SummaryRow | null;
}

const eligible = and(
  eq(gameRecords.kind, "level"),
  eq(gameRecords.result, "win"),
  eq(gameRecords.isFirstClear, true),
  sql`${gameRecords.level} between 1 and ${LEADERBOARD_LEVELS}`
);

function toIso(d: Date | string): string {
  return d instanceof Date ? d.toISOString() : new Date(d).toISOString();
}

export async function getLevelLeaderboard(
  db: Db,
  level: number,
  players: LeaderboardPlayerCount,
  userId: number | null
): Promise<LevelBoard> {
  if (!isLeaderboardLevel(level) || !isLeaderboardPlayerCount(players)) {
    return { level, players, top: [], me: null };
  }

  const rows = await db
    .select({
      id: gameRecords.id,
      userId: gameRecords.userId,
      username: users.username,
      score: gameRecords.score,
      ownQueries: gameRecords.ownQueries,
      greenCount: gameRecords.greenCount,
      ownWhiteCount: gameRecords.ownWhiteCount,
      playedAt: gameRecords.playedAt,
    })
    .from(gameRecords)
    .innerJoin(users, eq(users.id, gameRecords.userId))
    .where(and(eligible, eq(gameRecords.level, level), eq(gameRecords.playerCount, players)))
    .orderBy(asc(gameRecords.score), asc(gameRecords.playedAt), asc(gameRecords.id));

  const sorted = rows.map((r) => ({
    id: r.id,
    userId: r.userId,
    username: r.username,
    score: r.score,
    ownQueries: r.ownQueries,
    greenCount: r.greenCount,
    ownWhiteCount: r.ownWhiteCount,
    playedAtMs: new Date(r.playedAt).getTime(),
    playedAt: toIso(r.playedAt),
  }));

  const top: LeaderboardRow[] = sorted.slice(0, LEADERBOARD_TOP).map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    username: r.username,
    score: r.score,
    ownQueries: r.ownQueries,
    greenCount: r.greenCount,
    ownWhiteCount: r.ownWhiteCount,
    playedAt: r.playedAt,
  }));

  let me: LeaderboardRow | null = null;
  if (userId != null) {
    const mine = sorted.find((r) => r.userId === userId) ?? null;
    if (mine) {
      const rank =
        rankAmongSorted(
          sorted.map((r) => ({ score: r.score, playedAt: r.playedAtMs, id: r.id })),
          { score: mine.score, playedAt: mine.playedAtMs, id: mine.id },
          compareLeaderboardRows
        ) ?? null;
      me = {
        rank: rank!,
        userId: mine.userId,
        username: mine.username,
        score: mine.score,
        ownQueries: mine.ownQueries,
        greenCount: mine.greenCount,
        ownWhiteCount: mine.ownWhiteCount,
        playedAt: mine.playedAt,
      };
    }
  }

  return { level, players, top, me };
}

export async function getSummaryLeaderboard(
  db: Db,
  players: LeaderboardPlayerCount,
  userId: number | null
): Promise<SummaryBoard> {
  if (!isLeaderboardPlayerCount(players)) {
    return { players, top: [], me: null };
  }

  const rows = await db
    .select({
      userId: gameRecords.userId,
      username: users.username,
      clears: sql<number>`count(*)::int`.mapWith(Number),
      scoreSum: sql<number>`coalesce(sum(${gameRecords.score}), 0)::int`.mapWith(Number),
      lastPlayedAt: sql<Date>`max(${gameRecords.playedAt})`.mapWith((v) => new Date(v as string | Date)),
    })
    .from(gameRecords)
    .innerJoin(users, eq(users.id, gameRecords.userId))
    .where(and(eligible, eq(gameRecords.playerCount, players)))
    .groupBy(gameRecords.userId, users.username)
    .orderBy(
      desc(sql`count(*)`),
      asc(sql`coalesce(sum(${gameRecords.score}), 0)`),
      asc(sql`max(${gameRecords.playedAt})`),
      asc(gameRecords.userId)
    );

  const sorted = rows.map((r) => ({
    userId: r.userId,
    username: r.username,
    clears: r.clears,
    scoreSum: r.scoreSum,
    lastPlayedAtMs: r.lastPlayedAt.getTime(),
    lastPlayedAt: toIso(r.lastPlayedAt),
  }));

  const top: SummaryRow[] = sorted.slice(0, LEADERBOARD_TOP).map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    username: r.username,
    clears: r.clears,
    scoreSum: r.scoreSum,
    lastPlayedAt: r.lastPlayedAt,
  }));

  let me: SummaryRow | null = null;
  if (userId != null) {
    const mine = sorted.find((r) => r.userId === userId) ?? null;
    if (mine) {
      const rank =
        rankAmongSorted(
          sorted.map((r) => ({
            clears: r.clears,
            scoreSum: r.scoreSum,
            lastPlayedAt: r.lastPlayedAtMs,
            userId: r.userId,
          })),
          {
            clears: mine.clears,
            scoreSum: mine.scoreSum,
            lastPlayedAt: mine.lastPlayedAtMs,
            userId: mine.userId,
          },
          compareSummaryRows
        ) ?? null;
      me = {
        rank: rank!,
        userId: mine.userId,
        username: mine.username,
        clears: mine.clears,
        scoreSum: mine.scoreSum,
        lastPlayedAt: mine.lastPlayedAt,
      };
    }
  }

  return { players, top, me };
}
