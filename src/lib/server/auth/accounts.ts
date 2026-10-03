import { createHash, randomBytes } from "crypto";
import { and, eq, gt, lte, sql } from "drizzle-orm";
import type { Db } from "@/lib/server/db";
import { sessions, users } from "@/lib/server/db/schema";
import { normalizeUsername } from "@/lib/account/rules";
import { burnPasswordCheck, hashPassword, verifyPassword } from "./password";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AccountUser {
  id: number;
  username: string;
}

export class UsernameTakenError extends Error {
  constructor() {
    super("这个称呼已经有人用了");
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function isUniqueViolation(e: unknown): boolean {
  for (let cur: unknown = e; cur && typeof cur === "object"; cur = (cur as { cause?: unknown }).cause) {
    if ((cur as { code?: unknown }).code === "23505") return true;
  }
  return false;
}

export async function createUser(db: Db, rawUsername: string, password: string): Promise<AccountUser> {
  const username = normalizeUsername(rawUsername);
  const passwordHash = await hashPassword(password);
  try {
    const [row] = await db
      .insert(users)
      .values({ username, passwordHash })
      .returning({ id: users.id, username: users.username });
    return row;
  } catch (e) {
    if (isUniqueViolation(e)) throw new UsernameTakenError();
    throw e;
  }
}

export async function authenticate(db: Db, rawUsername: string, password: string): Promise<AccountUser | null> {
  const username = normalizeUsername(rawUsername);
  const [row] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`)
    .limit(1);
  if (!row) {
    await burnPasswordCheck(password);
    return null;
  }
  if (!(await verifyPassword(password, row.passwordHash))) return null;
  return { id: row.id, username: row.username };
}

export async function createSession(db: Db, userId: number, now = new Date()) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function resolveSession(db: Db, token: string, now = new Date()): Promise<AccountUser | null> {
  if (!token) return null;
  const id = hashToken(token);
  const [row] = await db
    .select({ id: users.id, username: users.username })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, id), gt(sessions.expiresAt, now)))
    .limit(1);
  if (!row) {
    await db.delete(sessions).where(and(eq(sessions.id, id), lte(sessions.expiresAt, now)));
    return null;
  }
  return row;
}

export async function deleteSession(db: Db, token: string) {
  if (!token) return;
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}
