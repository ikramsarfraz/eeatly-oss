-- =============================================================================
-- 0034_measurement_system.sql — per-user measurement-system preference
-- =============================================================================
-- 'metric' | 'imperial'. Inferred once at signup from the request's geo
-- (x-vercel-ip-country) / Accept-Language and flippable in Settings → Kitchen.
-- Biases the AI on capture + Refine; existing free-form quantity strings are
-- left verbatim. Defaults to 'metric' (the global majority) so existing rows
-- and absent rows resolve to metric.
--
-- Rollback: ALTER TABLE "user_settings" DROP COLUMN IF EXISTS "measurement_system";
-- =============================================================================

ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "measurement_system" text NOT NULL DEFAULT 'metric';
