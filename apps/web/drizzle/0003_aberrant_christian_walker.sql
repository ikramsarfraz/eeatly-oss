CREATE TYPE "public"."analytics_event_name" AS ENUM('signed_up', 'signed_in', 'onboarding_completed', 'meal_logged', 'meal_logged_again', 'feedback_submitted', 'rediscovery_clicked');--> statement-breakpoint
CREATE TABLE "analytics_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"name" "analytics_event_name" NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analytics_events_user_created_at_idx" ON "analytics_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_name_created_at_idx" ON "analytics_events" USING btree ("name","created_at");--> statement-breakpoint
CREATE INDEX "analytics_events_created_at_idx" ON "analytics_events" USING btree ("created_at");