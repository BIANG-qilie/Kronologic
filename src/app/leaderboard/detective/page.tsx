import type { Metadata } from "next";
import { DetectiveLeaderboard } from "@/components/detective/detective-leaderboard";
import { isDetectiveCase, isDetectiveDifficulty } from "@/lib/game/detective";

export const metadata: Metadata = {
  title: "探案排行榜 · 灯序",
};

export const dynamic = "force-dynamic";

type Search = { case?: string; difficulty?: string };

export default async function Page({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  return (
    <DetectiveLeaderboard
      initialCase={isDetectiveCase(sp.case) ? sp.case : "all"}
      initialDifficulty={isDetectiveDifficulty(sp.difficulty) ? sp.difficulty : "all"}
    />
  );
}
