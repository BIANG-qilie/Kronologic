import type { AchievementCode, GameMode, GameResult } from "@/lib/game/achievements";

export interface PublicUser {
  id: number;
  username: string;
}

export interface MeResponse {
  enabled: boolean;
  user: PublicUser | null;
  clearedLevels: number[];
}

/** What the results screen shows a signed-in player about this game. */
export type SeatRecord =
  | { status: "pending" }
  | { status: "failed" }
  | {
      status: "saved";
      result: GameResult;
      queriesUsed: number;
      isFirstClear: boolean;
      bestQueries: number | null;
      newAchievements: AchievementCode[];
    };

export interface ProfileLevel {
  level: number;
  minQueries: number;
  bestQueries: number | null;
  firstClearAt: string | null;
}

export interface ProfileRecord {
  id: number;
  level: number;
  mode: GameMode;
  result: GameResult;
  queriesUsed: number;
  minQueries: number;
  isFirstClear: boolean;
  playedAt: string;
}

export interface Profile {
  user: PublicUser & { createdAt: string };
  totals: { games: number; wins: number; cleared: number; levels: number };
  levels: ProfileLevel[];
  achievements: { code: AchievementCode; unlockedAt: string }[];
  recent: ProfileRecord[];
}

/** POST /api/tutorial/complete. Guests get `saved: false`. */
export type TutorialCompleteResponse = { saved: false } | { saved: true; newlyUnlocked: boolean };
