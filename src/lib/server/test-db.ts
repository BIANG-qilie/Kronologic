import type { Db } from "@/lib/server/db";
import { migrationsFolder, schema } from "@/lib/server/db";

/** Real Postgres when TEST_DATABASE_URL is set (e.g. a Docker container), otherwise in-process PGlite. */
export async function openTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const url = process.env.TEST_DATABASE_URL?.trim();
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    // Test files run in parallel processes, so each one gets a throwaway database.
    const name = `kr_test_${process.pid}_${Date.now()}`;
    const admin = postgres(url, { max: 1, onnotice: () => undefined });
    await admin.unsafe(`create database ${name}`);
    const target = new URL(url);
    target.pathname = `/${name}`;
    const client = postgres(target.toString(), { max: 4, onnotice: () => undefined });
    const db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: migrationsFolder() });
    return {
      db: db as unknown as Db,
      close: async () => {
        await client.end();
        await admin.unsafe(`drop database if exists ${name}`);
        await admin.end();
      },
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: migrationsFolder() });
  return { db: db as unknown as Db, close: () => client.close() };
}
