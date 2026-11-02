CREATE TYPE "public"."scoresheet_extraction_source" AS ENUM('acroform', 'qr_ocr', 'seeded_fallback');--> statement-breakpoint
ALTER TABLE "extracted_fields" ADD COLUMN "validation_flags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "extracted_fields" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "extracted_fields" ADD COLUMN "reviewed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "extracted_fields" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scoresheets" ADD COLUMN "preview_storage_key" text;--> statement-breakpoint
ALTER TABLE "scoresheets" ADD COLUMN "extraction_source" "scoresheet_extraction_source";--> statement-breakpoint
ALTER TABLE "scoresheets" ADD COLUMN "extraction_note" text;--> statement-breakpoint
ALTER TABLE "scoresheets" ADD COLUMN "reviewed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "scoresheets" ADD COLUMN "confirmed_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "scoresheets" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "extracted_fields" ADD CONSTRAINT "extracted_fields_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoresheets" ADD CONSTRAINT "scoresheets_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoresheets" ADD CONSTRAINT "scoresheets_confirmed_by_user_id_users_id_fk" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;