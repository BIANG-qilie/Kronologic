CREATE TABLE "detective_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"case_id" text NOT NULL,
	"difficulty" text NOT NULL,
	"level_id" text NOT NULL,
	"player_count" integer NOT NULL,
	"result" text NOT NULL,
	"green_count" integer NOT NULL,
	"white_count" integer NOT NULL,
	"queries" integer NOT NULL,
	"played_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "detective_records" ADD CONSTRAINT "detective_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "detective_records_board_idx" ON "detective_records" USING btree ("case_id","difficulty","user_id");--> statement-breakpoint
CREATE INDEX "detective_records_user_idx" ON "detective_records" USING btree ("user_id","played_at");
