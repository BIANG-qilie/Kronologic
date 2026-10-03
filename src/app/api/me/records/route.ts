import { NextResponse } from "next/server";
import { currentUser } from "@/lib/server/auth/current";
import { getProfile } from "@/lib/server/records";
import { jsonError, requireDb } from "@/lib/server/auth/routes";
import { listLevels } from "@/lib/game/scenarios";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const got = await requireDb();
  if ("res" in got) return got.res;
  const user = await currentUser();
  if (!user) return jsonError("登录后才能看战绩", 401);
  try {
    const profile = await getProfile(got.db, user.id, listLevels());
    if (!profile) return jsonError("登录后才能看战绩", 401);
    return NextResponse.json({ profile }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("accounts: profile failed", e);
    return jsonError("战绩暂时读不出来，稍后再试", 503);
  }
}
