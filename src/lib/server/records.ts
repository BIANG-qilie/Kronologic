import { and, count, desc, eq, min, sql } from "drizzle-orm";
import type { Db } from "@/lib/server/db";
import { achievements, gameRecords, users } from "@/lib/server/db/schema";
import {
  achievementByCode,
  evaluateAchievements,
  isFirstClear,
  type AchievementCode,
  type GameOutcome,
} from "@/lib/game/achievements";
import type { LevelInfo } from "@/lib/game/levels";
import type { Profile, SeatRecord } from "@/lib/account/types";

export interface GameRecordInput extends GameOutcome {
  userId: number;
  caseId: string;
  playedAt?: Date;
}

export type SavedRecord = Extract<SeatRecord, { status: "saved" }>;

async function wonLevels(db: Pick<Db, "selectDistinct">, userId: number): Promise<Set<number>> {
  const rows = await db
    .selectDistinct({ level: gameRecords.level })
    .from(gameRecords)
    .where(and(eq(gameRecords.userId, userId), eq(gameRecords.result, "win")));
  return new Set(rows.map((r) => r.level));
}

export async function clearedLevels(db: Db, userId: number): Promise<number[]> {
  return [...(await wonLevels(db, userId))].sort((a, b) => a - b);
}

/** One row per signed-in seat; first-clear and achievements are judged against prior history. */
export async function recordGameResult(db: Db, input: GameRecordInput): Promise<SavedRecord> {
  return db.transaction(async (tx) => {
    const cleared = await wonLevels(tx, input.userId);
    const unlockedRows = await tx
      .select({ code: achievements.code })
      .from(achievements)
      .where(eq(achievements.userId, input.userId));
    const unlocked = new Set(unlockedRows.map((r) => r.code));

    const firstClear = isFirstClear(input, cleared);
    await tx.insert(gameRecords).values({
      userId: input.userId,
      level: input.level,
      caseId: input.caseId,
      mode: input.mode,
      result: input.result,
      queriesUsed: input.queriesUsed,
      minQueries: input.minQueries,
      isFirstClear: firstClear,
      ...(input.playedAt ? { playedAt: input.playedAt } : {}),
    });

    const earned = evaluateAchievements(input, { clearedLevels: cleared, unlocked });
    let newAchievements: AchievementCode[] = [];
    if (earned.length) {
      const inserted = await tx
        .insert(achievements)
        .values(earned.map((code) => ({ userId: input.userId, code })))
        .onConflictDoNothing()
        .returning({ code: achievements.code });
      const got = new Set(inserted.map((r) => r.code));
      newAchievements = earned.filter((c) => got.has(c));
    }

    const [best] = await tx
      .select({ best: min(gameRecords.queriesUsed) })
      .from(gameRecords)
      .where(
        and(
          eq(gameRecords.userId, input.userId),
          eq(gameRecords.level, input.level),
          eq(gameRecords.result, "win")
        )
      );

    return {
      status: "saved" as const,
      result: input.result,
      queriesUsed: input.queriesUsed,
      isFirstClear: firstClear,
      bestQueries: best?.best ?? null,
      newAchievements,
    };
  });
}

export async function getProfile(db: Db, userId: number, levels: readonly LevelInfo[]): Promise<Profile | null> {
  const [user] = await db
    .select({ id: users.id, username: users.username, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) return null;

  const [totals] = await db
    .select({
      games: count(),
      wins: sql<number>`count(*) filter (where ${gameRecords.result} = 'win')`.mapWith(Number),
    })
    .from(gameRecords)
    .where(eq(gameRecords.userId, userId));

  const perLevel = await db
    .select({
      level: gameRecords.level,
      best: min(gameRecords.queriesUsed),
      firstClearAt: min(gameRecords.playedAt),
    })
    .from(gameRecords)
    .where(and(eq(gameRecords.userId, userId), eq(gameRecords.result, "win")))
    .groupBy(gameRecords.level);
  const byLevel = new Map(perLevel.map((r) => [r.level, r]));

  const unlocked = await db
    .select({ code: achievements.code, unlockedAt: achievements.unlockedAt })
    .from(achievements)
    .where(eq(achievements.userId, userId))
    .orderBy(achievements.unlockedAt);

  const recent = await db
    .select()
    .from(gameRecords)
    .where(eq(gameRecords.userId, userId))
    .orderBy(desc(gameRecords.playedAt), desc(gameRecords.id))
    .limit(20);

  return {
    user: { id: user.id, username: user.username, createdAt: user.createdAt.toISOString() },
    totals: {
      games: totals?.games ?? 0,
      wins: totals?.wins ?? 0,
      cleared: levels.filter((l) => byLevel.has(l.level)).length,
      levels: levels.length,
    },
    levels: levels.map((l) => {
      const row = byLevel.get(l.level);
      return {
        level: l.level,
        minQueries: l.greedyMin,
        bestQueries: row?.best ?? null,
        firstClearAt: row?.firstClearAt ? new Date(row.firstClearAt).toISOString() : null,
      };
    }),
    achievements: unlocked
      .filter((a) => achievementByCode(a.code))
      .map((a) => ({ code: a.code as AchievementCode, unlockedAt: a.unlockedAt.toISOString() })),
    recent: recent.map((r) => ({
      id: r.id,
      level: r.level,
      mode: r.mode,
      result: r.result,
      queriesUsed: r.queriesUsed,
      minQueries: r.minQueries,
      isFirstClear: r.isFirstClear,
      playedAt: r.playedAt.toISOString(),
    })),
  };
}
