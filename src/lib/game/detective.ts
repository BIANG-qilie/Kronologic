import { CUSTOM_CASES } from "./custom-cases";
import { CUSTOM_DIFFICULTIES, getCustomDifficulty, randomSeed } from "./custom-level";
import type { CustomDifficultyId, CustomLevelRequest } from "./types";
import { DETECTIVE_ACHIEVEMENTS } from "./achievements";

/** Cases the detective draw can land on. New custom cases join automatically. */
export const DETECTIVE_CASES = CUSTOM_CASES.map((c) => ({
  id: c.id,
  title: c.title,
  venue: c.venue,
  year: c.year,
  blurb: c.blurb,
}));

export type DetectiveCase = (typeof DETECTIVE_CASES)[number];

export const DETECTIVE_DIFFICULTIES = CUSTOM_DIFFICULTIES;

/** Kept below the custom maximum so a draw finishes while the reels still spin. */
export const DETECTIVE_NODE_MIN = 6;
export const DETECTIVE_NODE_MAX = 9;

/** Players need this many games on a board before they are ranked. */
export const DETECTIVE_MIN_GAMES = 3;
export const DETECTIVE_TOP = 50;

export function isDetectiveDifficulty(v: unknown): v is CustomDifficultyId {
  return typeof v === "string" && !!getCustomDifficulty(v);
}

export function isDetectiveCase(v: unknown): v is string {
  return typeof v === "string" && DETECTIVE_CASES.some((c) => c.id === v);
}

/** One random draw: case, room count, one-way and stay switches. Counts stay random inside the generator. */
export function rollDetectiveRequest(
  difficulty: CustomDifficultyId,
  rng: () => number = Math.random,
  seed: string = randomSeed()
): CustomLevelRequest {
  const c = DETECTIVE_CASES[Math.floor(rng() * DETECTIVE_CASES.length)] ?? DETECTIVE_CASES[0];
  const nodeCount = DETECTIVE_NODE_MIN + Math.floor(rng() * (DETECTIVE_NODE_MAX - DETECTIVE_NODE_MIN + 1));
  return {
    caseId: c.id,
    nodeCount,
    oneWay: rng() < 0.5,
    oneWayCount: null,
    stay: rng() < 0.5,
    stayCount: null,
    difficulty,
    seed,
  };
}

/** Per-player sums straight from the database. */
export interface DetectiveTotals {
  userId: number;
  username: string;
  games: number;
  wins: number;
  greenSum: number;
  whiteSum: number;
  querySum: number;
}

export interface DetectiveStats {
  userId: number;
  username: string;
  games: number;
  wins: number;
  winRate: number;
  avgGreen: number;
  avgWhite: number;
  avgQueries: number;
}

export function aggregateDetective(t: DetectiveTotals): DetectiveStats {
  const g = Math.max(1, t.games);
  return {
    userId: t.userId,
    username: t.username,
    games: t.games,
    wins: t.wins,
    winRate: t.games ? t.wins / t.games : 0,
    avgGreen: t.greenSum / g,
    avgWhite: t.whiteSum / g,
    avgQueries: t.querySum / g,
  };
}

/** Values within this distance count as a tie, so float noise never decides a rank. */
const EPS = 1e-9;

function cmp(a: number, b: number): number {
  return Math.abs(a - b) < EPS ? 0 : a - b;
}

/** Higher win rate, then fewer green windows, fewer asks, fewer white windows, more games; user id breaks ties. */
export function compareDetectiveStats(a: DetectiveStats, b: DetectiveStats): number {
  return (
    cmp(b.winRate, a.winRate) ||
    cmp(a.avgGreen, b.avgGreen) ||
    cmp(a.avgQueries, b.avgQueries) ||
    cmp(a.avgWhite, b.avgWhite) ||
    b.games - a.games ||
    a.userId - b.userId
  );
}

export interface DetectiveRanked extends DetectiveStats {
  rank: number;
}

export interface DetectiveBoard {
  ranked: DetectiveRanked[];
  /** The viewer, ranked or not; `rank` is null below the games threshold. */
  me: (DetectiveStats & { rank: number | null }) | null;
}

export function rankDetective(
  totals: DetectiveTotals[],
  userId: number | null,
  minGames = DETECTIVE_MIN_GAMES,
  top = DETECTIVE_TOP
): DetectiveBoard {
  const all = totals.map(aggregateDetective);
  const eligible = all.filter((s) => s.games >= minGames).sort(compareDetectiveStats);
  const ranked = eligible.map((s, i) => ({ ...s, rank: i + 1 }));
  let me: DetectiveBoard["me"] = null;
  if (userId != null) {
    const mine = all.find((s) => s.userId === userId);
    if (mine) me = { ...mine, rank: ranked.find((r) => r.userId === userId)?.rank ?? null };
  }
  return { ranked: ranked.slice(0, top), me };
}

/** Gold magnifiers on 烧脑 needed before 极限 can be drawn. */
export const EXPERT_UNLOCK_GOLDS = 3;

export interface ExpertUnlock {
  unlocked: boolean;
  golds: number;
  remaining: number;
}

export function expertUnlock(golds: number): ExpertUnlock {
  const remaining = Math.max(0, EXPERT_UNLOCK_GOLDS - golds);
  return { unlocked: remaining === 0, golds, remaining };
}

/** Whether a player with `unlock` may draw at `difficulty`. */
export function canDrawDifficulty(difficulty: string, unlock: ExpertUnlock): boolean {
  return difficulty !== "expert" || unlock.unlocked;
}

export const DETECTIVE_WINS_FOR_REGULAR = 10;

/** Fallback ask floor per difficulty when a record carries none. */
export const DEFAULT_BAND_MIN: Record<CustomDifficultyId, number> = { easy: 4, normal: 6, hard: 8, expert: 10 };

export function bandMinFor(difficulty: CustomDifficultyId): number {
  return getCustomDifficulty(difficulty)?.min ?? DEFAULT_BAND_MIN[difficulty];
}

export interface DetectiveOutcome {
  difficulty: CustomDifficultyId;
  result: "win" | "lose" | "eliminated";
  rating: "gold" | "silver" | "copper" | null;
  queries: number;
  bandMin: number | null;
}

/** Totals after this game has been counted. */
export interface DetectiveHistory {
  wins: number;
  hardGolds: number;
  unlocked: ReadonlySet<string>;
}

type DetectiveCode = (typeof DETECTIVE_ACHIEVEMENTS)[number];

const DETECTIVE_RULES: Record<DetectiveCode, (o: DetectiveOutcome, h: DetectiveHistory) => boolean> = {
  detective_first_night: (o) => o.result === "win",
  detective_gold_three: (_o, h) => h.hardGolds >= EXPERT_UNLOCK_GOLDS,
  detective_expert: (o) => o.result === "win" && o.difficulty === "expert",
  detective_terse: (o) => o.result === "win" && o.queries <= (o.bandMin ?? DEFAULT_BAND_MIN[o.difficulty]),
  detective_regular: (_o, h) => h.wins >= DETECTIVE_WINS_FOR_REGULAR,
};

export function evaluateDetectiveAchievements(o: DetectiveOutcome, h: DetectiveHistory): DetectiveCode[] {
  return DETECTIVE_ACHIEVEMENTS.filter((code) => !h.unlocked.has(code) && DETECTIVE_RULES[code](o, h));
}
