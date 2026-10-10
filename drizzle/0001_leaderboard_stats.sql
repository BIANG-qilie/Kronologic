ALTER TABLE "game_records" ADD COLUMN "player_count" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_records" ADD COLUMN "own_queries" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_records" ADD COLUMN "green_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_records" ADD COLUMN "own_white_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_records" ADD COLUMN "score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "game_records" SET
  "own_queries" = "queries_used",
  "score" = "queries_used",
  "player_count" = CASE WHEN "mode" = 'solo' THEN 1 ELSE 2 END;--> statement-breakpoint
CREATE INDEX "game_records_leaderboard_idx" ON "game_records" USING btree ("level","player_count","is_first_clear","result","score","played_at");
