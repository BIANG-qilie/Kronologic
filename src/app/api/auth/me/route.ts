import { NextResponse } from "next/server";
import { accountsEnabled, getDb } from "@/lib/server/db";
import { currentUser } from "@/lib/server/auth/current";
import { clearedLevels } from "@/lib/server/records";
import type { MeResponse } from "@/lib/account/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const body: MeResponse = { enabled: accountsEnabled(), user: null, clearedLevels: [] };
  if (!body.enabled) return NextResponse.json(body);
  const user = await currentUser();
  if (user) {
    body.user = user;
    try {
      const db = await getDb();
      if (db) body.clearedLevels = await clearedLevels(db, user.id);
    } catch (e) {
      console.error("accounts: cleared levels lookup failed", e);
    }
  }
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
