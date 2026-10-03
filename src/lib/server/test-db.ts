import type { Db } from "@/lib/server/db";
import { migrationsFolder, schema } from "@/lib/server/db";

/** Real Postgres when TEST_DATABASE_URL is set (e.g. a Docker container), otherwise in-process PGlite. */
export async function openTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const url = process.env.TEST_DATABASE_URL?.trim();
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, { max: 4, onnotice: () => undefined });
    await client.unsafe(
      "drop schema if exists public cascade; create schema public; drop schema if exists drizzle cascade;"
    );
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: migrationsFolder() });
    return { db: db as unknown as Db, close: () => client.end() };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: migrationsFolder() });
  return { db: db as unknown as Db, close: () => client.close() };
}
