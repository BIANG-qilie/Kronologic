import { NextResponse } from "next/server";
import { getDb, type Db } from "@/lib/server/db";

export const ACCOUNTS_OFF = "账号功能暂未开放，可以先以游客身份玩";
export const ACCOUNTS_DOWN = "账号服务暂时连不上，可以先以游客身份玩";

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Resolves the database or an error response ready to return from a route. */
export async function requireDb(): Promise<{ db: Db } | { res: NextResponse }> {
  try {
    const db = await getDb();
    if (!db) return { res: jsonError(ACCOUNTS_OFF, 503) };
    return { db };
  } catch (e) {
    console.error("accounts: database unavailable", e);
    return { res: jsonError(ACCOUNTS_DOWN, 503) };
  }
}

export async function readCredentials(req: Request) {
  try {
    const body = await req.json();
    return { username: String(body?.username ?? ""), password: String(body?.password ?? "") };
  } catch {
    return { username: "", password: "" };
  }
}
