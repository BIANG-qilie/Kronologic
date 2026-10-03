import path from "path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export { schema };
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export function migrationsFolder(): string {
  return path.join(process.cwd(), "drizzle");
}

declare global {
  // eslint-disable-next-line no-var
  var __kronoDb: Promise<Db> | null | undefined;
}

/** Accounts exist only when a database is configured; guests can always play. */
export function accountsEnabled(): boolean {
  return !!globalThis.__kronoDb || !!process.env.DATABASE_URL?.trim();
}

async function connect(url: string): Promise<Db> {
  const client = postgres(url, { max: 5, connect_timeout: 10, onnotice: () => undefined });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: migrationsFolder() });
  return db as unknown as Db;
}

/** Connects and migrates once per process. Resolves to null when accounts are off. */
export async function getDb(): Promise<Db | null> {
  if (globalThis.__kronoDb) return globalThis.__kronoDb;
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  const pending = connect(url);
  globalThis.__kronoDb = pending;
  pending.catch(() => {
    if (globalThis.__kronoDb === pending) globalThis.__kronoDb = null;
  });
  return pending;
}

/** Tests inject a PGlite-backed database here. */
export function setDb(db: Db | null) {
  globalThis.__kronoDb = db ? Promise.resolve(db) : null;
}
