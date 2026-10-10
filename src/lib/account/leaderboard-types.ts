import type { LeaderboardPlayerCount } from "@/lib/game/leaderboard";

export interface LeaderboardEntryDto {
  rank: number;
  userId: number;
  username: string;
  score: number;
  ownQueries: number;
  greenCount: number;
  ownWhiteCount: number;
  playedAt: string;
}

export interface SummaryEntryDto {
  rank: number;
  userId: number;
  username: string;
  clears: number;
  scoreSum: number;
  lastPlayedAt: string;
}

export type LevelLeaderboardResponse = {
  enabled: boolean;
  level: number;
  players: LeaderboardPlayerCount;
  top: LeaderboardEntryDto[];
  me: LeaderboardEntryDto | null;
};

export type SummaryLeaderboardResponse = {
  enabled: boolean;
  players: LeaderboardPlayerCount;
  top: SummaryEntryDto[];
  me: SummaryEntryDto | null;
};
