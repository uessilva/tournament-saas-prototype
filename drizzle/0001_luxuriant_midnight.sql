CREATE TYPE "public"."match_slot_source" AS ENUM('group_qualifier', 'match_winner', 'bye');--> statement-breakpoint
CREATE TABLE "match_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"side" "match_side" NOT NULL,
	"source_type" "match_slot_source" NOT NULL,
	"group_id" uuid,
	"group_position" integer,
	"source_match_id" uuid
);
--> statement-breakpoint
ALTER TABLE "competitions" ADD COLUMN "group_count" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "bracket_slot" integer;--> statement-breakpoint
ALTER TABLE "match_slots" ADD CONSTRAINT "match_slots_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_slots" ADD CONSTRAINT "match_slots_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_slots" ADD CONSTRAINT "match_slots_source_match_id_matches_id_fk" FOREIGN KEY ("source_match_id") REFERENCES "public"."matches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_slots_match_side_uq" ON "match_slots" USING btree ("match_id","side");--> statement-breakpoint
CREATE INDEX "match_slots_source_match_idx" ON "match_slots" USING btree ("source_match_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_competition_round_slot_uq" ON "matches" USING btree ("competition_id","round_number","bracket_slot");