import { and, eq, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/lib/server/db";
import { detectiveRecords, users } from "@/lib/server/db/schema";
import {
  isDetectiveCase,
  isDetectiveDifficulty,
  rankDetective,
  type DetectiveBoard,
} from "@/lib/game/detective";
import type { CustomDifficultyId } from "@/lib/game/types";

export interface DetectiveRoomMeta {
  caseId: string;
  difficulty: CustomDifficultyId;
  levelId: string;
}

export interface DetectiveRecordInput {
  userId: number;
  caseId: string;
  difficulty: CustomDifficultyId;
  levelId: string;
  playerCount: number;
  result: "win" | "lose" | "eliminated";
  greenCount: number;
  whiteCount: number;
  queries: number;
  playedAt?: Date;
}

export class DetectiveAuthError extends Error {
  constructor() {
    super("探案模式要先登录，战绩记在你的账号名下");
    this.name = "DetectiveAuthError";
  }
}

/** Guests may not open or join a detective game. */
export function assertDetectivePlayer<U extends { id: number; username: string }>(user: U | null): U {
  if (!user) throw new DetectiveAuthError();
  return user;
}

export async function recordDetectiveResult(db: Db, input: DetectiveRecordInput): Promise<void> {
  await db.insert(detectiveRecords).values({
    userId: input.userId,
    caseId: input.caseId,
    difficulty: input.difficulty,
    levelId: input.levelId,
    playerCount: input.playerCount,
    result: input.result,
    greenCount: input.greenCount,
    whiteCount: input.whiteCount,
    queries: input.queries,
    ...(input.playedAt ? { playedAt: input.playedAt } : {}),
  });
}

export interface DetectiveFilter {
  caseId?: string | null;
  difficulty?: string | null;
}

export async function getDetectiveLeaderboard(
  db: Db,
  filter: DetectiveFilter,
  userId: number | null
): Promise<DetectiveBoard> {
  const where: SQL[] = [];
  if (filter.caseId && isDetectiveCase(filter.caseId)) where.push(eq(detectiveRecords.caseId, filter.caseId));
  if (filter.difficulty && isDetectiveDifficulty(filter.difficulty)) {
    where.push(eq(detectiveRecords.difficulty, filter.difficulty));
  }
  const rows = await db
    .select({
      userId: detectiveRecords.userId,
      username: users.username,
      games: sql<number>`count(*)::int`.mapWith(Number),
      wins: sql<number>`count(*) filter (where ${detectiveRecords.result} = 'win')`.mapWith(Number),
      greenSum: sql<number>`coalesce(sum(${detectiveRecords.greenCount}), 0)::int`.mapWith(Number),
      whiteSum: sql<number>`coalesce(sum(${detectiveRecords.whiteCount}), 0)::int`.mapWith(Number),
      querySum: sql<number>`coalesce(sum(${detectiveRecords.queries}), 0)::int`.mapWith(Number),
    })
    .from(detectiveRecords)
    .innerJoin(users, eq(users.id, detectiveRecords.userId))
    .where(where.length ? and(...where) : undefined)
    .groupBy(detectiveRecords.userId, users.username);
  return rankDetective(rows, userId);
}
