import { and, count, eq, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/lib/server/db";
import { achievements, detectiveRecords, users } from "@/lib/server/db/schema";
import type { AchievementCode } from "@/lib/game/achievements";
import {
  EXPERT_UNLOCK_GOLDS,
  evaluateDetectiveAchievements,
  expertUnlock,
  isDetectiveCase,
  type ExpertUnlock,
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
  rating?: "gold" | "silver" | "copper" | null;
  bandMin?: number | null;
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

/** Writes the row and unlocks any detective achievements it earns; returns the new codes. */
export async function recordDetectiveResult(db: Db, input: DetectiveRecordInput): Promise<AchievementCode[]> {
  return db.transaction(async (tx) => {
  await tx.insert(detectiveRecords).values({
    userId: input.userId,
    caseId: input.caseId,
    difficulty: input.difficulty,
    levelId: input.levelId,
    playerCount: input.playerCount,
    result: input.result,
    rating: input.rating ?? null,
    bandMin: input.bandMin ?? null,
    greenCount: input.greenCount,
    whiteCount: input.whiteCount,
    queries: input.queries,
    ...(input.playedAt ? { playedAt: input.playedAt } : {}),
  });
  const [totals] = await tx
    .select({
      wins: sql<number>`count(*) filter (where ${detectiveRecords.result} = 'win')`.mapWith(Number),
      hardGolds: sql<number>`count(*) filter (where ${detectiveRecords.result} = 'win' and ${detectiveRecords.difficulty} = 'hard' and ${detectiveRecords.rating} = 'gold')`.mapWith(Number),
    })
    .from(detectiveRecords)
    .where(eq(detectiveRecords.userId, input.userId));
  const unlockedRows = await tx
    .select({ code: achievements.code })
    .from(achievements)
    .where(eq(achievements.userId, input.userId));
  const earned = evaluateDetectiveAchievements(
    {
      difficulty: input.difficulty,
      result: input.result,
      rating: input.rating ?? null,
      queries: input.queries,
      bandMin: input.bandMin ?? null,
    },
    { wins: totals?.wins ?? 0, hardGolds: totals?.hardGolds ?? 0, unlocked: new Set(unlockedRows.map((r) => r.code)) }
  );
  if (!earned.length) return [];
  const inserted = await tx
    .insert(achievements)
    .values(earned.map((code) => ({ userId: input.userId, code })))
    .onConflictDoNothing()
    .returning({ code: achievements.code });
  const got = new Set(inserted.map((r) => r.code));
  return earned.filter((c) => got.has(c));
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

/** Gold-magnifier wins on 烧脑 (hard); 极限 opens at EXPERT_UNLOCK_GOLDS of them. */
export async function getExpertUnlock(db: Db, userId: number): Promise<ExpertUnlock> {
  const [row] = await db
    .select({ n: count() })
    .from(detectiveRecords)
    .where(
      and(
        eq(detectiveRecords.userId, userId),
        eq(detectiveRecords.difficulty, "hard"),
        eq(detectiveRecords.result, "win"),
        eq(detectiveRecords.rating, "gold")
      )
    );
  return expertUnlock(row?.n ?? 0);
}

export { EXPERT_UNLOCK_GOLDS };
