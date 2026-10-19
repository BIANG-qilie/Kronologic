import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { currentUser } from "@/lib/server/auth/current";
import { getDetectiveLeaderboard } from "@/lib/server/detective";
import { DETECTIVE_MIN_GAMES } from "@/lib/game/detective";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const caseId = sp.get("case");
  const difficulty = sp.get("difficulty");
  const base = { minGames: DETECTIVE_MIN_GAMES, caseId: caseId ?? "all", difficulty: difficulty ?? "all" };
  let db;
  try {
    db = await getDb();
  } catch (e) {
    console.error("detective leaderboard: database unavailable", e);
    return NextResponse.json({ error: "排行榜暂时打不开，稍后再试" }, { status: 503 });
  }
  if (!db) return NextResponse.json({ ...base, enabled: false, ranked: [], me: null });
  const user = await currentUser();
  try {
    const board = await getDetectiveLeaderboard(db, { caseId, difficulty }, user?.id ?? null);
    return NextResponse.json({ ...base, enabled: true, ...board });
  } catch (e) {
    console.error("detective leaderboard: query failed", e);
    return NextResponse.json({ error: "排行榜暂时打不开，稍后再试" }, { status: 500 });
  }
}
