import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "./auth/password";
import {
  SESSION_TTL_MS,
  UsernameTakenError,
  authenticate,
  createSession,
  createUser,
  deleteSession,
  resolveSession,
} from "./auth/accounts";
import { clearHits, isLimited, recordHit } from "./auth/rate-limit";
import { passwordProblem, usernameProblem } from "@/lib/account/rules";
import { openTestDb } from "./test-db";
import type { Db } from "./db";

describe("password hashing", () => {
  it("verifies the right password and rejects a wrong one", async () => {
    const hash = await hashPassword("灯序夜茶-2026");
    assert.match(hash, /^scrypt\$16384\$8\$1\$/);
    assert.equal(await verifyPassword("灯序夜茶-2026", hash), true);
    assert.equal(await verifyPassword("灯序夜茶-2025", hash), false);
  });

  it("salts every hash", async () => {
    assert.notEqual(await hashPassword("same-password"), await hashPassword("same-password"));
  });

  it("rejects malformed stored hashes", async () => {
    assert.equal(await verifyPassword("x", "plain"), false);
    assert.equal(await verifyPassword("x", "scrypt$0$8$1$aa$bb"), false);
  });
});

describe("username and password rules", () => {
  it("accepts 2–16 Chinese, latin, digit or underscore characters", () => {
    assert.equal(usernameProblem("夜班侦探"), null);
    assert.equal(usernameProblem("night_owl_07"), null);
    assert.ok(usernameProblem("a"));
    assert.ok(usernameProblem("一二三四五六七八九十一二三四五六七"));
    assert.ok(usernameProblem("no spaces"));
    assert.ok(usernameProblem("emoji🙂"));
  });

  it("needs at least 8 password characters", () => {
    assert.ok(passwordProblem("1234567"));
    assert.equal(passwordProblem("12345678"), null);
  });
});

describe("rate limit", () => {
  it("blocks after the limit inside the window and recovers after it", () => {
    const key = "test:1.2.3.4";
    clearHits(key);
    for (let i = 0; i < 3; i++) recordHit(key, 1000 + i);
    assert.equal(isLimited(key, 3, 10_000, 2000), true);
    assert.equal(isLimited(key, 3, 10_000, 20_000), false);
  });
});

describe("accounts and sessions", () => {
  let db: Db;
  let close: () => Promise<void>;
  before(async () => ({ db, close } = await openTestDb()));
  after(async () => close());

  it("registers and logs in case-insensitively", async () => {
    const user = await createUser(db, "Lantern", "correct-horse");
    assert.equal(user.username, "Lantern");
    assert.equal((await authenticate(db, "lantern", "correct-horse"))?.id, user.id);
    assert.equal(await authenticate(db, "lantern", "wrong-horse"), null);
    assert.equal(await authenticate(db, "nobody", "correct-horse"), null);
    await assert.rejects(createUser(db, "LANTERN", "another-pass"), UsernameTakenError);
  });

  it("resolves a session until it expires, then forgets it", async () => {
    const user = await createUser(db, "过期测试", "password-1");
    const t0 = new Date("2026-01-01T00:00:00Z");
    const { token, expiresAt } = await createSession(db, user.id, t0);
    assert.equal(expiresAt.getTime() - t0.getTime(), SESSION_TTL_MS);
    assert.equal((await resolveSession(db, token, new Date(t0.getTime() + 1000)))?.id, user.id);
    const late = new Date(t0.getTime() + SESSION_TTL_MS + 1);
    assert.equal(await resolveSession(db, token, late), null);
    assert.equal(await resolveSession(db, token, t0), null, "expired row is deleted");
  });

  it("logs out by deleting the session", async () => {
    const user = await createUser(db, "logout_me", "password-2");
    const { token } = await createSession(db, user.id);
    await deleteSession(db, token);
    assert.equal(await resolveSession(db, token), null);
    assert.equal(await resolveSession(db, "not-a-token"), null);
  });
});
