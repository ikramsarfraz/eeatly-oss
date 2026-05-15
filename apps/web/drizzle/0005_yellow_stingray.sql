CREATE TYPE "public"."beta_cohort" AS ENUM('alpha', 'beta_wave_1', 'beta_wave_2', 'internal');--> statement-breakpoint
ALTER TYPE "public"."analytics_event_name" ADD VALUE 'reminder_email_sent';--> statement-breakpoint
ALTER TYPE "public"."analytics_event_name" ADD VALUE 'reminder_email_open_placeholder';--> statement-breakpoint
ALTER TYPE "public"."analytics_event_name" ADD VALUE 'reminder_email_clicked_placeholder';--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "beta_cohort" "beta_cohort";