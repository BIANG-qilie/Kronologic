/**
 * Seed demo users + first-clear wins so /leaderboard looks lived-in during UI polish.
 * Usage: DATABASE_URL=... node scripts/seed-leaderboard-demo.mjs
 */
import postgres from "postgres";
import { createHash, randomBytes, scryptSync } from "crypto";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

function hashPassword(password) {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

const sql = postgres(url, { max: 1, onnotice: () => undefined });

const people = [
  { name: "幕后者", solo: [[1, 4], [3, 7]], duo: [[1, 3, 2, 1]] },
  { name: "夜行者", solo: [[1, 5], [2, 6]], duo: [[3, 2, 3, 1]] },
  { name: "提灯人", solo: [[1, 5]], duo: [] },
  { name: "拾答甲", solo: [[2, 7]], duo: [[2, 4, 1, 0]] },
  { name: "观灯客", solo: [[4, 8], [5, 9]], duo: [] },
  { name: "末席", solo: [[6, 11]], duo: [[4, 5, 2, 2]] },
];

try {
  for (const [i, p] of people.entries()) {
    const existing = await sql`select id from users where lower(username) = lower(${p.name}) limit 1`;
    let userId = existing[0]?.id;
    if (!userId) {
      const [row] = await sql`
        insert into users (username, password_hash)
        values (${p.name}, ${hashPassword("lampxu-demo")})
        returning id
      `;
      userId = row.id;
    }

    for (const [level, ownQueries] of p.solo) {
      const played = new Date(Date.UTC(2026, 2, 1 + i + level, 8 + level, 0, 0));
      const dup = await sql`
        select id from game_records
        where user_id = ${userId} and level = ${level} and player_count = 1 and is_first_clear = true
        limit 1
      `;
      if (dup.length) continue;
      await sql`
        insert into game_records (
          user_id, level, case_id, mode, result, queries_used, min_queries,
          is_first_clear, player_count, own_queries, green_count, own_white_count, score, played_at
        ) values (
          ${userId}, ${level}, ${`seed-solo-${level}-${userId}`}, 'solo', 'win',
          ${ownQueries}, 3, true, 1, ${ownQueries}, 0, 0, ${ownQueries}, ${played}
        )
      `;
    }

    for (const [level, ownQueries, green, white] of p.duo) {
      const score = ownQueries + green + white;
      const played = new Date(Date.UTC(2026, 2, 10 + i, 12, level * 10, 0));
      const dup = await sql`
        select id from game_records
        where user_id = ${userId} and level = ${level} and player_count = 2 and is_first_clear = true
        limit 1
      `;
      if (dup.length) continue;
      await sql`
        insert into game_records (
          user_id, level, case_id, mode, result, queries_used, min_queries,
          is_first_clear, player_count, own_queries, green_count, own_white_count, score, played_at
        ) values (
          ${userId}, ${level}, ${`seed-duo-${level}-${userId}`}, 'multi', 'win',
          ${ownQueries}, 3, true, 2, ${ownQueries}, ${green}, ${white}, ${score}, ${played}
        )
      `;
    }
  }
  console.log("seeded leaderboard demo rows");
} finally {
  await sql.end();
}
