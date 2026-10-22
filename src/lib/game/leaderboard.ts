/** Pure scoring / eligibility for the ranked boards (no I/O). */

export const LEADERBOARD_TOP = 20;
export const LEADERBOARD_LEVELS = 15;
export const LEADERBOARD_PLAYER_COUNTS = [1, 2, 3, 4] as const;

export type LeaderboardPlayerCount = (typeof LEADERBOARD_PLAYER_COUNTS)[number];

export interface ScoreParts {
  ownQueries: number;
  greenCount: number;
  ownWhiteCount: number;
}

/** 1 人局只比提问；2/3/4 人局再加公开信息与本人私有信息（均越少越前）。 */
export function leaderboardScore(playerCount: number, parts: ScoreParts): number {
  const { ownQueries, greenCount, ownWhiteCount } = parts;
  if (playerCount <= 1) return ownQueries;
  return ownQueries + greenCount + ownWhiteCount;
}

/** 非空私有信息：有实质 privateLabel（不是 "—" / 空）。 */
export function isNonEmptyWhite(privateLabel: string | null | undefined): boolean {
  const label = (privateLabel ?? "").trim();
  return label.length > 0 && label !== "—";
}

export function countOwnWhite(privateLabels: readonly (string | null | undefined)[]): number {
  return privateLabels.filter(isNonEmptyWhite).length;
}

/** 序幕（0）与未收录关不上榜；仅 1–15。 */
export function isLeaderboardLevel(level: number): boolean {
  return Number.isInteger(level) && level >= 1 && level <= LEADERBOARD_LEVELS;
}

export function isLeaderboardPlayerCount(n: number): n is LeaderboardPlayerCount {
  return (LEADERBOARD_PLAYER_COUNTS as readonly number[]).includes(n);
}

/** 仅首通胜利且关卡合法才参与排行（游客不写库，此处不判）。 */
export function qualifiesForLeaderboard(input: {
  result: string;
  isFirstClear: boolean;
  level: number;
}): boolean {
  return input.result === "win" && input.isFirstClear && isLeaderboardLevel(input.level);
}

/**
 * 名次比较：得分更小靠前；同分 played_at 更早靠前；再同分用稳定 id。
 * 返回负数表示 a 更靠前。
 */
export function compareLeaderboardRows(
  a: { score: number; playedAt: number; id?: number },
  b: { score: number; playedAt: number; id?: number }
): number {
  if (a.score !== b.score) return a.score - b.score;
  if (a.playedAt !== b.playedAt) return a.playedAt - b.playedAt;
  return (a.id ?? 0) - (b.id ?? 0);
}

/**
 * 总榜：通关数优先；同分比得分之和（越少越好）；再比最晚首通时间更早。
 */
export function compareSummaryRows(
  a: { clears: number; scoreSum: number; lastPlayedAt: number; userId?: number },
  b: { clears: number; scoreSum: number; lastPlayedAt: number; userId?: number }
): number {
  if (a.clears !== b.clears) return b.clears - a.clears;
  if (a.scoreSum !== b.scoreSum) return a.scoreSum - b.scoreSum;
  if (a.lastPlayedAt !== b.lastPlayedAt) return a.lastPlayedAt - b.lastPlayedAt;
  return (a.userId ?? 0) - (b.userId ?? 0);
}

/** 在已排序列表中找名次（1-based）；不在列表则按插入位置推算。 */
export function rankAmongSorted<T>(
  sorted: readonly T[],
  me: T | null,
  cmp: (a: T, b: T) => number
): number | null {
  if (!me) return null;
  let rank = 1;
  for (const row of sorted) {
    if (cmp(row, me) < 0) rank += 1;
    else break;
  }
  return rank;
}
