CREATE TYPE "public"."email_delivery_status" AS ENUM('pending', 'delayed', 'sent', 'delivered', 'opened', 'clicked', 'complained', 'bounced', 'failed', 'suppressed');--> statement-breakpoint
ALTER TYPE "public"."analytics_event_name" ADD VALUE 'email_sent';--> statement-breakpoint
ALTER TYPE "public"."analytics_event_name" ADD VALUE 'email_delivered';--> statement-breakpoint
ALTER TYPE "public"."analytics_event_name" ADD VALUE 'email_opened';--> statement-breakpoint
ALTER TYPE "public"."analytics_event_name" ADD VALUE 'email_clicked';--> statement-breakpoint
ALTER TYPE "public"."analytics_event_name" ADD VALUE 'email_bounced';--> statement-breakpoint
ALTER TYPE "public"."analytics_event_name" ADD VALUE 'email_complained';--> statement-breakpoint
ALTER TYPE "public"."analytics_event_name" ADD VALUE 'email_delivery_failed';--> statement-breakpoint
CREATE TABLE "email_delivery_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_message_id" text NOT NULL,
	"template_key" text,
	"recipient" text NOT NULL,
	"user_id" text,
	"status" "email_delivery_status" DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"metadata" jsonb,
	"last_provider_event_type" text,
	"last_event_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_delivery_logs_provider_message_id_unique" UNIQUE("provider_message_id")
);
--> statement-breakpoint
CREATE TABLE "resend_webhook_receipts" (
	"svix_id" text PRIMARY KEY NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_delivery_logs" ADD CONSTRAINT "email_delivery_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "email_delivery_logs_status_idx" ON "email_delivery_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "email_delivery_logs_last_event_at_idx" ON "email_delivery_logs" USING btree ("last_event_at");--> statement-breakpoint
CREATE INDEX "email_delivery_logs_user_id_idx" ON "email_delivery_logs" USING btree ("user_id");