import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_username_lower_idx").on(sql`lower(${t.username})`)]
);

export const sessions = pgTable(
  "sessions",
  {
    /** sha256 of the cookie token; the raw token never reaches the database. */
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

export const gameRecords = pgTable(
  "game_records",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    level: integer("level").notNull(),
    caseId: text("case_id").notNull(),
    mode: text("mode", { enum: ["solo", "multi"] }).notNull(),
    result: text("result", { enum: ["win", "lose", "eliminated"] }).notNull(),
    queriesUsed: integer("queries_used").notNull(),
    minQueries: integer("min_queries").notNull(),
    isFirstClear: boolean("is_first_clear").notNull().default(false),
    /** Seated players at kickoff (1–4). Snapshot for leaderboard boards. */
    playerCount: integer("player_count").notNull().default(1),
    /** Counted asks by this seat (empty white / ask-again excluded). */
    ownQueries: integer("own_queries").notNull().default(0),
    /** Shared green-window rows produced in-play (excludes opening). */
    greenCount: integer("green_count").notNull().default(0),
    /** Non-empty white windows this seat received. */
    ownWhiteCount: integer("own_white_count").notNull().default(0),
    /** Board score: solo = own_queries; multi = own_queries + green + own_white. */
    score: integer("score").notNull().default(0),
    /** "custom" rows show in personal history only: never on boards, never a first clear. */
    kind: text("kind", { enum: ["level", "custom"] }).notNull().default("level"),
    /** Custom-level parameters and seed, e.g. "夜茶的毒 · 8 地点 · 进阶 · 单向 2 · #SEED". */
    customLabel: text("custom_label"),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("game_records_user_played_idx").on(t.userId, t.playedAt),
    index("game_records_user_level_idx").on(t.userId, t.level),
    index("game_records_leaderboard_idx").on(
      t.level,
      t.playerCount,
      t.isFirstClear,
      t.result,
      t.score,
      t.playedAt
    ),
  ]
);

export const achievements = pgTable(
  "achievements",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.code] })]
);

/** One row per signed-in seat in a finished detective-mode (random case + random map) game. */
export const detectiveRecords = pgTable(
  "detective_records",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    caseId: text("case_id").notNull(),
    difficulty: text("difficulty", { enum: ["easy", "normal", "hard", "expert"] }).notNull(),
    /** Seed of the generated level, so a game can be replayed or audited. */
    levelId: text("level_id").notNull(),
    playerCount: integer("player_count").notNull(),
    result: text("result", { enum: ["win", "lose", "eliminated"] }).notNull(),
    /** Magnifier earned on a win by this seat's own asks; null when the seat did not win. */
    rating: text("rating", { enum: ["gold", "silver", "copper"] }),
    /** Ask floor of the difficulty band at draw time. */
    bandMin: integer("band_min"),
    greenCount: integer("green_count").notNull(),
    whiteCount: integer("white_count").notNull(),
    queries: integer("queries").notNull(),
    playedAt: timestamp("played_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("detective_records_board_idx").on(t.caseId, t.difficulty, t.userId),
    index("detective_records_user_idx").on(t.userId, t.playedAt),
  ]
);
