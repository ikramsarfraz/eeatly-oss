CREATE TYPE "public"."feedback_type" AS ENUM('bug', 'confusion', 'feature_request', 'general');--> statement-breakpoint
CREATE TABLE "beta_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "feedback_type" NOT NULL,
	"message" text NOT NULL,
	"context" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "beta_feedback" ADD CONSTRAINT "beta_feedback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "beta_feedback_user_created_at_idx" ON "beta_feedback" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "beta_feedback_type_created_at_idx" ON "beta_feedback" USING btree ("type","created_at");