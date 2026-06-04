-- =============================================================================
-- 0038_ai_usage_events.sql — queryable per-call AI token usage
-- =============================================================================
-- Adds ai_usage_events: one row per LLM provider call (model + token counts +
-- user/op), so admin COGS is computed from REAL tokens × model price instead of
-- a flat estimate. Written fire-and-forget by lib/ai/usage-context.ts. Image
-- generation (no token usage) and Whisper (per-minute) are costed separately.
--
-- Hand-authored: drizzle-kit generate is blocked by pre-existing rename-
-- ambiguity drift, so this single new table is written by hand (CREATE … IF
-- NOT EXISTS, so re-applying is safe).
--
-- Rollback:
--   DROP TABLE IF EXISTS "ai_usage_events";
-- =============================================================================

CREATE TABLE IF NOT EXISTS "ai_usage_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text REFERENCES "user"("id") ON DELETE SET NULL,
  "operation" text,
  "provider" text NOT NULL,
  "model" text NOT NULL,
  "input_tokens" integer NOT NULL DEFAULT 0,
  "output_tokens" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ai_usage_events_created_idx" ON "ai_usage_events" ("created_at");
CREATE INDEX IF NOT EXISTS "ai_usage_events_user_created_idx" ON "ai_usage_events" ("user_id", "created_at");
