-- R36 Library PR2: AI auto-tags for faceted filtering. Single-select facets are
-- columns; Diet + Occasion are arrays. Free-form text (no enums) so the
-- taxonomy can grow without migrations.
ALTER TABLE "meals" ADD COLUMN IF NOT EXISTS "cuisine" text;--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN IF NOT EXISTS "course" text;--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN IF NOT EXISTS "main_ingredient" text;--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN IF NOT EXISTS "diet" text[];--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN IF NOT EXISTS "occasion" text[];--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN IF NOT EXISTS "tags_source" text;--> statement-breakpoint
ALTER TABLE "meals" ADD COLUMN IF NOT EXISTS "tagged_at" timestamp with time zone;
