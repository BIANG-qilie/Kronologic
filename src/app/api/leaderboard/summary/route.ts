import { NextResponse } from "next/server";
import { accountsEnabled, getDb } from "@/lib/server/db";
import { currentUser } from "@/lib/server/auth/current";
import { getSummaryLeaderboard } from "@/lib/server/leaderboard";
import {
  isLeaderboardPlayerCount,
  type LeaderboardPlayerCount,
} from "@/lib/game/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const empty = (players: LeaderboardPlayerCount) => ({
  enabled: false as const,
  players,
  top: [] as const,
  me: null,
});

/** GET /api/leaderboard/summary?players=1|2|3|4 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const playersRaw = Number(url.searchParams.get("players") ?? "1");
  const players = Number.isFinite(playersRaw) ? playersRaw : NaN;

  if (!isLeaderboardPlayerCount(players)) {
    return NextResponse.json({ error: "参数无效：players 需为 1–4" }, { status: 400 });
  }

  if (!accountsEnabled()) {
    return NextResponse.json(empty(players), { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const db = await getDb();
    if (!db) {
      return NextResponse.json(empty(players), { headers: { "Cache-Control": "no-store" } });
    }
    const user = await currentUser();
    const board = await getSummaryLeaderboard(db, players, user?.id ?? null);
    return NextResponse.json(
      { enabled: true, ...board },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    console.error("leaderboard: summary board failed", e);
    return NextResponse.json(empty(players), { headers: { "Cache-Control": "no-store" } });
  }
}
