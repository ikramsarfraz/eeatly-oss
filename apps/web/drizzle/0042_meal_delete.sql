-- R36 Library: destructive "Delete" as a soft-delete on meals, distinct from
-- the existing `archived_at` (which now means the user-facing reversible
-- "Archive"). Deleted rows are excluded from every view, including the
-- Archived view; Undo restores within the toast window by clearing this.
ALTER TABLE "meals" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "meals_household_deleted_at_idx" ON "meals" ("household_id","deleted_at");
