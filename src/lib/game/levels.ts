/**
 * Levels 1…N: bank cases ordered by minimum queries (ascending, stable),
 * so difficulty never drops as the level number grows.
 */
export function orderByDifficulty<T extends { greedySteps: number }>(cases: readonly T[]): T[] {
  return cases
    .map((c, i) => ({ c, i }))
    .sort((a, b) => a.c.greedySteps - b.c.greedySteps || a.i - b.i)
    .map(({ c }) => c);
}

export function levelLabel(level: number): string {
  return `第 ${level} 关`;
}

export type LevelInfo = { level: number; greedyMin: number };

/** First uncleared level after the highest cleared one; falls back to the first gap, then level 1. */
export function suggestLevel(levels: readonly LevelInfo[], cleared: ReadonlySet<number>): number {
  if (!levels.length) return 1;
  const max = Math.max(0, ...cleared);
  const after = levels.find((l) => l.level > max && !cleared.has(l.level));
  if (after) return after.level;
  const gap = levels.find((l) => !cleared.has(l.level));
  return gap?.level ?? levels[0].level;
}

/** Old progress stored the highest cleared min-query tier; map it onto levels. */
export function migrateClearedTier(levels: readonly LevelInfo[], tier: number): number[] {
  if (!Number.isFinite(tier) || tier <= 0) return [];
  return levels.filter((l) => l.greedyMin <= tier).map((l) => l.level);
}
