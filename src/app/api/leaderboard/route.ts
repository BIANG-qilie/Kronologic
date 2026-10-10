import { NextResponse } from "next/server";
import { accountsEnabled, getDb } from "@/lib/server/db";
import { currentUser } from "@/lib/server/auth/current";
import { getLevelLeaderboard, getSummaryLeaderboard } from "@/lib/server/leaderboard";
import {
  isLeaderboardLevel,
  isLeaderboardPlayerCount,
  type LeaderboardPlayerCount,
} from "@/lib/game/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const emptyLevel = (level: number, players: LeaderboardPlayerCount) => ({
  enabled: false as const,
  kind: "level" as const,
  level,
  players,
  top: [] as const,
  me: null,
});

const emptySummary = (players: LeaderboardPlayerCount) => ({
  enabled: false as const,
  kind: "summary" as const,
  players,
  top: [] as const,
  me: null,
});

/** GET /api/leaderboard?level=all|1..15&players=1|2|3|4 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const levelParam = url.searchParams.get("level") ?? "1";
  const playersRaw = Number(url.searchParams.get("players") ?? "1");
  const players = Number.isFinite(playersRaw) ? playersRaw : NaN;

  if (!isLeaderboardPlayerCount(players)) {
    return NextResponse.json({ error: "参数无效：players 需为 1–4" }, { status: 400 });
  }

  const wantSummary = levelParam === "all";
  const level = wantSummary ? NaN : Number(levelParam);
  if (!wantSummary && !isLeaderboardLevel(level)) {
    return NextResponse.json(
      { error: "参数无效：level 需为 all 或 1–15" },
      { status: 400 }
    );
  }

  if (!accountsEnabled()) {
    return NextResponse.json(wantSummary ? emptySummary(players) : emptyLevel(level, players), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const db = await getDb();
    if (!db) {
      return NextResponse.json(wantSummary ? emptySummary(players) : emptyLevel(level, players), {
        headers: { "Cache-Control": "no-store" },
      });
    }
    const user = await currentUser();
    if (wantSummary) {
      const board = await getSummaryLeaderboard(db, players, user?.id ?? null);
      return NextResponse.json(
        { enabled: true, kind: "summary", ...board },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    const board = await getLevelLeaderboard(db, level, players, user?.id ?? null);
    return NextResponse.json(
      { enabled: true, kind: "level", ...board },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("leaderboard: board failed", e);
    return NextResponse.json(wantSummary ? emptySummary(players) : emptyLevel(level, players), {
      headers: { "Cache-Control": "no-store" },
    });
  }
}
