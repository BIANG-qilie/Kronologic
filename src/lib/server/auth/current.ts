import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getDb } from "@/lib/server/db";
import { resolveSession, type AccountUser } from "./accounts";

export const SESSION_COOKIE = "kr_session";

export function setSessionCookie(res: NextResponse, token: string, expiresAt: Date) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

export async function sessionToken(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

/** Never throws: a broken database just means "playing as a guest". */
export async function currentUser(): Promise<AccountUser | null> {
  try {
    const token = await sessionToken();
    if (!token) return null;
    const db = await getDb();
    if (!db) return null;
    return await resolveSession(db, token);
  } catch (e) {
    console.error("accounts: session lookup failed", e);
    return null;
  }
}
