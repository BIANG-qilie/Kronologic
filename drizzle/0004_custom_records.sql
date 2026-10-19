ALTER TABLE "game_records" ADD COLUMN "kind" text DEFAULT 'level' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_records" ADD COLUMN "custom_label" text;
