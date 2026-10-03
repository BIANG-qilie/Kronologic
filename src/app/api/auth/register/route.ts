import { NextResponse } from "next/server";
import { passwordProblem, usernameProblem } from "@/lib/account/rules";
import { createSession, createUser, UsernameTakenError } from "@/lib/server/auth/accounts";
import { setSessionCookie } from "@/lib/server/auth/current";
import { clientIp, isLimited, recordHit } from "@/lib/server/auth/rate-limit";
import { ACCOUNTS_DOWN, jsonError, readCredentials, requireDb } from "@/lib/server/auth/routes";

export const runtime = "nodejs";

const LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  const key = `register:${clientIp(req)}`;
  if (isLimited(key, LIMIT, WINDOW_MS)) return jsonError("注册太频繁了，过一会儿再来", 429);

  const { username, password } = await readCredentials(req);
  const problem = usernameProblem(username) ?? passwordProblem(password);
  if (problem) return jsonError(problem, 400);

  const got = await requireDb();
  if ("res" in got) return got.res;

  recordHit(key);
  try {
    const user = await createUser(got.db, username, password);
    const { token, expiresAt } = await createSession(got.db, user.id);
    const res = NextResponse.json({ user });
    setSessionCookie(res, token, expiresAt);
    return res;
  } catch (e) {
    if (e instanceof UsernameTakenError) return jsonError(e.message, 409);
    console.error("accounts: register failed", e);
    return jsonError(ACCOUNTS_DOWN, 503);
  }
}
