import type { Metadata } from "next";
import { LeaderboardPage } from "@/components/account/leaderboard-page";
import {
  isLeaderboardLevel,
  isLeaderboardPlayerCount,
  type LeaderboardPlayerCount,
} from "@/lib/game/leaderboard";

export const metadata: Metadata = {
  title: "排行榜 · 灯序",
};

export const dynamic = "force-dynamic";

type Search = { level?: string; players?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const levelParam = sp.level ?? "all";
  const initialLevel =
    levelParam === "all"
      ? ("all" as const)
      : isLeaderboardLevel(Number(levelParam))
        ? Number(levelParam)
        : ("all" as const);
  const playersRaw = Number(sp.players ?? "1");
  const initialPlayers: LeaderboardPlayerCount = isLeaderboardPlayerCount(playersRaw) ? playersRaw : 1;
  return <LeaderboardPage initialLevel={initialLevel} initialPlayers={initialPlayers} />;
}
