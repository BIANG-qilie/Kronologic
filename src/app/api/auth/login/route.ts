import { NextResponse } from "next/server";
import { LOGIN_FAILED } from "@/lib/account/rules";
import { authenticate, createSession } from "@/lib/server/auth/accounts";
import { setSessionCookie } from "@/lib/server/auth/current";
import { clearHits, clientIp, isLimited, recordHit } from "@/lib/server/auth/rate-limit";
import { ACCOUNTS_DOWN, jsonError, readCredentials, requireDb } from "@/lib/server/auth/routes";

export const runtime = "nodejs";

const LIMIT = 8;
const WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  const key = `login:${clientIp(req)}`;
  if (isLimited(key, LIMIT, WINDOW_MS)) return jsonError("试得太频繁了，过几分钟再来", 429);

  const { username, password } = await readCredentials(req);
  if (!username.trim() || !password) return jsonError(LOGIN_FAILED, 401);

  const got = await requireDb();
  if ("res" in got) return got.res;

  try {
    const user = await authenticate(got.db, username, password);
    if (!user) {
      recordHit(key);
      return jsonError(LOGIN_FAILED, 401);
    }
    clearHits(key);
    const { token, expiresAt } = await createSession(got.db, user.id);
    const res = NextResponse.json({ user });
    setSessionCookie(res, token, expiresAt);
    return res;
  } catch (e) {
    console.error("accounts: login failed", e);
    return jsonError(ACCOUNTS_DOWN, 503);
  }
}
