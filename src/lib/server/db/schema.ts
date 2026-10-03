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
    playedAt: timestamp("played_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("game_records_user_played_idx").on(t.userId, t.playedAt),
    index("game_records_user_level_idx").on(t.userId, t.level),
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
