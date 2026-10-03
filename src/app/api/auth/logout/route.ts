import { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { deleteSession } from "@/lib/server/auth/accounts";
import { clearSessionCookie, sessionToken } from "@/lib/server/auth/current";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(res);
  try {
    const token = await sessionToken();
    const db = await getDb();
    if (token && db) await deleteSession(db, token);
  } catch (e) {
    console.error("accounts: logout cleanup failed", e);
  }
  return res;
}
