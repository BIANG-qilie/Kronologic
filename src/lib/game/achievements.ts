export const TOTAL_LEVELS = 15;
/** Mirrors the submit window in rooms.ts: late answers inside it count as a comeback. */
export const COMEBACK_WINDOW_MS = 12_000;

export type GameMode = "solo" | "multi";
export type GameResult = "win" | "lose" | "eliminated";

export const ACHIEVEMENTS = [
  { code: "debut", title: "初登场", description: "完成第一局" },
  { code: "first_win", title: "首胜", description: "第一次通关" },
  { code: "perfect", title: "一问不差", description: "单人局用最少提问数通关任意一关" },
  { code: "level_5", title: "渐入佳境", description: "通关第 5 关" },
  { code: "all_clear", title: "灯序大师", description: `通关全部 ${TOTAL_LEVELS} 关` },
  { code: "quick_draw", title: "抢答者", description: "多人局里第一个交卷并答对" },
  { code: "comeback", title: "绝境翻盘", description: "多人局里他人先交卷后，在 12 秒内答对" },
] as const;

export type AchievementCode = (typeof ACHIEVEMENTS)[number]["code"];
export type AchievementDef = (typeof ACHIEVEMENTS)[number];

const BY_CODE = new Map<string, AchievementDef>(ACHIEVEMENTS.map((a) => [a.code, a]));

export function achievementByCode(code: string): AchievementDef | undefined {
  return BY_CODE.get(code);
}

export interface GameOutcome {
  level: number;
  mode: GameMode;
  result: GameResult;
  queriesUsed: number;
  minQueries: number;
  /** This player opened the submit window that decided the game. */
  firstToSubmit: boolean;
  /** Milliseconds between someone else opening the window and this player's answer. */
  msAfterFirstSubmit: number | null;
}

export interface PlayerHistory {
  /** Levels won before this game. */
  clearedLevels: ReadonlySet<number>;
  unlocked: ReadonlySet<string>;
}

export function isFirstClear(outcome: Pick<GameOutcome, "result" | "level">, clearedBefore: ReadonlySet<number>) {
  return outcome.result === "win" && !clearedBefore.has(outcome.level);
}

const RULES: Record<AchievementCode, (o: GameOutcome, clearedAfter: ReadonlySet<number>) => boolean> = {
  debut: () => true,
  first_win: (o) => o.result === "win",
  perfect: (o) => o.result === "win" && o.mode === "solo" && o.queriesUsed <= o.minQueries,
  level_5: (_o, cleared) => cleared.has(5),
  all_clear: (_o, cleared) => Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1).every((l) => cleared.has(l)),
  quick_draw: (o) => o.result === "win" && o.mode === "multi" && o.firstToSubmit,
  comeback: (o) =>
    o.result === "win" &&
    o.mode === "multi" &&
    !o.firstToSubmit &&
    o.msAfterFirstSubmit != null &&
    o.msAfterFirstSubmit <= COMEBACK_WINDOW_MS,
};

/** Achievements this game newly unlocks, in display order. */
export function evaluateAchievements(outcome: GameOutcome, history: PlayerHistory): AchievementCode[] {
  const clearedAfter = new Set(history.clearedLevels);
  if (outcome.result === "win") clearedAfter.add(outcome.level);
  return ACHIEVEMENTS.map((a) => a.code).filter(
    (code) => !history.unlocked.has(code) && RULES[code](outcome, clearedAfter)
  );
}
