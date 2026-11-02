CREATE TYPE "public"."access_event_type" AS ENUM('invitation_created', 'invitation_email_sent', 'invitation_accepted', 'invitation_revoked', 'invitation_expired', 'link_created', 'link_revoked', 'link_accepted', 'manager_removed');--> statement-breakpoint
CREATE TYPE "public"."competition_format" AS ENUM('round_robin', 'single_elimination', 'groups_knockout');--> statement-breakpoint
CREATE TYPE "public"."competition_status" AS ENUM('setup', 'registration_open', 'registration_closed', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."dispute_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."invitation_kind" AS ENUM('email', 'link');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."match_side" AS ENUM('home', 'away');--> statement-breakpoint
CREATE TYPE "public"."match_stage" AS ENUM('group', 'knockout');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'awaiting_result', 'in_review', 'published', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."registration_state" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."result_source" AS ENUM('scoresheet', 'manual', 'walkover');--> statement-breakpoint
CREATE TYPE "public"."scoresheet_status" AS ENUM('uploaded', 'processing', 'needs_review', 'confirmed', 'extraction_failed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."sport" AS ENUM('football', 'tennis');--> statement-breakpoint
CREATE TABLE "access_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"team_id" uuid,
	"invitation_id" uuid,
	"actor_user_id" uuid,
	"subject_user_id" uuid,
	"type" "access_event_type" NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_account_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"type" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"summary" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authenticators" (
	"credential_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"provider_account_id" text NOT NULL,
	"credential_public_key" text NOT NULL,
	"counter" integer NOT NULL,
	"credential_device_type" text NOT NULL,
	"credential_backed_up" boolean NOT NULL,
	"transports" text,
	CONSTRAINT "authenticators_user_credential_pk" PRIMARY KEY("user_id","credential_id"),
	CONSTRAINT "authenticators_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "competitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sport" "sport" NOT NULL,
	"format" "competition_format" NOT NULL,
	"description" text,
	"eligibility_notes" text,
	"birth_date_from" date,
	"birth_date_to" date,
	"roster_min" integer,
	"roster_max" integer,
	"registration_state" "registration_state" DEFAULT 'open' NOT NULL,
	"registration_deadline" timestamp with time zone,
	"qualifiers_per_group" integer DEFAULT 2 NOT NULL,
	"default_match_duration_minutes" integer DEFAULT 50 NOT NULL,
	"draw_seed" text,
	"draw_generated_at" timestamp with time zone,
	"status" "competition_status" DEFAULT 'setup' NOT NULL,
	"public_note" text,
	"cancelled_at" timestamp with time zone,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"opened_by_user_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"status" "dispute_status" DEFAULT 'open' NOT NULL,
	"explanation" text NOT NULL,
	"response" text,
	"resolved_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"correction_result_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"tagline" text,
	"description" text,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"location_label" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "extracted_fields" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scoresheet_id" uuid NOT NULL,
	"field_key" text NOT NULL,
	"label" text,
	"page" integer DEFAULT 1 NOT NULL,
	"raw_value" text,
	"normalized_value" text,
	"reviewed_value" text,
	"confidence" integer,
	"crop_storage_key" text,
	"crop_box" jsonb,
	"needs_review" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "football_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_version_id" uuid NOT NULL,
	"home_score" integer NOT NULL,
	"away_score" integer NOT NULL,
	"is_walkover" boolean DEFAULT false NOT NULL,
	"walkover_winner_team_id" uuid,
	"penalty_home" integer,
	"penalty_away" integer,
	"notes" text,
	CONSTRAINT "football_results_result_version_id_unique" UNIQUE("result_version_id")
);
--> statement-breakpoint
CREATE TABLE "group_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"seed_position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation_teams" (
	"invitation_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	CONSTRAINT "invitation_teams_pk" PRIMARY KEY("invitation_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manager_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"kind" "invitation_kind" NOT NULL,
	"email" text,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by_user_id" uuid,
	"revoked_at" timestamp with time zone,
	"created_by_user_id" uuid NOT NULL,
	"last_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manager_invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "match_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"side" "match_side" NOT NULL,
	"team_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"group_id" uuid,
	"venue_id" uuid,
	"stage" "match_stage" DEFAULT 'group' NOT NULL,
	"round_label" text,
	"round_number" integer DEFAULT 1 NOT NULL,
	"match_number" integer NOT NULL,
	"starts_at" timestamp with time zone,
	"duration_minutes" integer,
	"status" "match_status" DEFAULT 'scheduled' NOT NULL,
	"is_bye" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participant_statistics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_version_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"goals" integer DEFAULT 0 NOT NULL,
	"assists" integer DEFAULT 0 NOT NULL,
	"aces" integer DEFAULT 0 NOT NULL,
	"double_faults" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"date_of_birth" date NOT NULL,
	"shirt_number" integer,
	"position" text,
	"is_captain" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "result_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"source" "result_source" NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"reason" text,
	"created_by_user_id" uuid,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoresheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"original_filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"template_version" text,
	"qr_sheet_id" text,
	"page_count" integer,
	"status" "scoresheet_status" DEFAULT 'uploaded' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"processing_started_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"failure_reason" text,
	"rejection_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_managers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"competition_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"short_name" text,
	"primary_color" text,
	"seed_position" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tennis_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"result_version_id" uuid NOT NULL,
	"winner_team_id" uuid NOT NULL,
	"sets" jsonb NOT NULL,
	"is_walkover" boolean DEFAULT false NOT NULL,
	"notes" text,
	CONSTRAINT "tennis_results_result_version_id_unique" UNIQUE("result_version_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_invitation_id_manager_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."manager_invitations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_events" ADD CONSTRAINT "access_events_subject_user_id_users_id_fk" FOREIGN KEY ("subject_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authenticators" ADD CONSTRAINT "authenticators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitions" ADD CONSTRAINT "competitions_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_opened_by_user_id_users_id_fk" FOREIGN KEY ("opened_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_correction_result_version_id_result_versions_id_fk" FOREIGN KEY ("correction_result_version_id") REFERENCES "public"."result_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "extracted_fields" ADD CONSTRAINT "extracted_fields_scoresheet_id_scoresheets_id_fk" FOREIGN KEY ("scoresheet_id") REFERENCES "public"."scoresheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "football_results" ADD CONSTRAINT "football_results_result_version_id_result_versions_id_fk" FOREIGN KEY ("result_version_id") REFERENCES "public"."result_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "football_results" ADD CONSTRAINT "football_results_walkover_winner_team_id_teams_id_fk" FOREIGN KEY ("walkover_winner_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_entries" ADD CONSTRAINT "group_entries_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_entries" ADD CONSTRAINT "group_entries_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_teams" ADD CONSTRAINT "invitation_teams_invitation_id_manager_invitations_id_fk" FOREIGN KEY ("invitation_id") REFERENCES "public"."manager_invitations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation_teams" ADD CONSTRAINT "invitation_teams_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_invitations" ADD CONSTRAINT "manager_invitations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_invitations" ADD CONSTRAINT "manager_invitations_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manager_invitations" ADD CONSTRAINT "manager_invitations_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_entries" ADD CONSTRAINT "match_entries_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_entries" ADD CONSTRAINT "match_entries_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_venue_id_venues_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_statistics" ADD CONSTRAINT "participant_statistics_result_version_id_result_versions_id_fk" FOREIGN KEY ("result_version_id") REFERENCES "public"."result_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_statistics" ADD CONSTRAINT "participant_statistics_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_statistics" ADD CONSTRAINT "participant_statistics_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participant_statistics" ADD CONSTRAINT "participant_statistics_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_versions" ADD CONSTRAINT "result_versions_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_versions" ADD CONSTRAINT "result_versions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "result_versions" ADD CONSTRAINT "result_versions_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoresheets" ADD CONSTRAINT "scoresheets_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoresheets" ADD CONSTRAINT "scoresheets_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_managers" ADD CONSTRAINT "team_managers_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_managers" ADD CONSTRAINT "team_managers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_competition_id_competitions_id_fk" FOREIGN KEY ("competition_id") REFERENCES "public"."competitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tennis_results" ADD CONSTRAINT "tennis_results_result_version_id_result_versions_id_fk" FOREIGN KEY ("result_version_id") REFERENCES "public"."result_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tennis_results" ADD CONSTRAINT "tennis_results_winner_team_id_teams_id_fk" FOREIGN KEY ("winner_team_id") REFERENCES "public"."teams"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "venues" ADD CONSTRAINT "venues_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "access_events_event_created_idx" ON "access_events" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_events_event_created_idx" ON "audit_events" USING btree ("event_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "competitions_event_slug_uq" ON "competitions" USING btree ("event_id","slug");--> statement-breakpoint
CREATE INDEX "competitions_event_idx" ON "competitions" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_match_open_uq" ON "disputes" USING btree ("match_id") WHERE "disputes"."status" = 'open';--> statement-breakpoint
CREATE INDEX "disputes_match_idx" ON "disputes" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "events_owner_idx" ON "events" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "extracted_fields_sheet_key_uq" ON "extracted_fields" USING btree ("scoresheet_id","field_key");--> statement-breakpoint
CREATE UNIQUE INDEX "group_entries_group_team_uq" ON "group_entries" USING btree ("group_id","team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "group_entries_group_position_uq" ON "group_entries" USING btree ("group_id","seed_position");--> statement-breakpoint
CREATE UNIQUE INDEX "groups_competition_name_uq" ON "groups" USING btree ("competition_id","name");--> statement-breakpoint
CREATE INDEX "jobs_status_available_idx" ON "jobs" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "jobs_type_idx" ON "jobs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "manager_invitations_event_idx" ON "manager_invitations" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "manager_invitations_email_idx" ON "manager_invitations" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "match_entries_match_side_uq" ON "match_entries" USING btree ("match_id","side");--> statement-breakpoint
CREATE UNIQUE INDEX "match_entries_match_team_uq" ON "match_entries" USING btree ("match_id","team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "matches_competition_number_uq" ON "matches" USING btree ("competition_id","match_number");--> statement-breakpoint
CREATE INDEX "matches_competition_starts_idx" ON "matches" USING btree ("competition_id","starts_at");--> statement-breakpoint
CREATE INDEX "matches_status_idx" ON "matches" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "participant_statistics_version_person_uq" ON "participant_statistics" USING btree ("result_version_id","participant_id");--> statement-breakpoint
CREATE INDEX "participant_statistics_match_idx" ON "participant_statistics" USING btree ("match_id");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_competition_person_uq" ON "participants" USING btree ("competition_id","first_name","last_name","date_of_birth");--> statement-breakpoint
CREATE INDEX "participants_team_idx" ON "participants" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "result_versions_match_version_uq" ON "result_versions" USING btree ("match_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "result_versions_match_current_uq" ON "result_versions" USING btree ("match_id") WHERE "result_versions"."is_current" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "scoresheets_match_active_uq" ON "scoresheets" USING btree ("match_id") WHERE "scoresheets"."is_active" = true;--> statement-breakpoint
CREATE INDEX "scoresheets_match_idx" ON "scoresheets" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "scoresheets_status_idx" ON "scoresheets" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "team_managers_team_user_uq" ON "team_managers" USING btree ("team_id","user_id");--> statement-breakpoint
CREATE INDEX "team_managers_user_idx" ON "team_managers" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "teams_competition_slug_uq" ON "teams" USING btree ("competition_id","slug");--> statement-breakpoint
CREATE INDEX "teams_competition_idx" ON "teams" USING btree ("competition_id");--> statement-breakpoint
CREATE UNIQUE INDEX "venues_event_slug_uq" ON "venues" USING btree ("event_id","slug");--> statement-breakpoint
CREATE INDEX "venues_event_idx" ON "venues" USING btree ("event_id");