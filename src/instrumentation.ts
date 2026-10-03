export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !process.env.DATABASE_URL?.trim()) return;
  const { getDb } = await import("@/lib/server/db");
  try {
    await getDb();
    console.log("accounts: database ready, migrations applied");
  } catch (e) {
    console.error("accounts: database unavailable, will retry on first use", e);
  }
}
