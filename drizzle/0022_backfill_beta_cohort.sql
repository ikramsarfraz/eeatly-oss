-- =============================================================================
-- 0022_backfill_beta_cohort.sql — Round 6 backfill all existing users to beta
-- =============================================================================
-- Round 6 wires feature gates to subscription state. The default rule for
-- every gated feature is `beta_or_paid` — without an explicit cohort
-- assignment, every existing user would lose access to AI / household
-- invites / plans the moment the gates ship.
--
-- This migration grants the `beta_2026` cohort to every user without one
-- already, retroactively unlocking the existing surfaces. It's idempotent
-- (`WHERE beta_cohort IS NULL`) so re-running is safe; users with a
-- different existing cohort (alpha / internal / beta_wave_*) stay where
-- they are — those memberships were assigned manually and shouldn't be
-- overwritten.
--
-- Sequencing: 0021 added the `beta_2026` enum value with a statement
-- breakpoint so this migration can reference it. Both must run before
-- Round 6's gates code ships, OR existing users (including the author
-- and their household) hit paywalls on first login.
--
-- New users created AFTER this migration runs do NOT auto-receive
-- `beta_2026`. The gates allow / deny them based on subscription state.
-- An admin can grant the cohort via /admin/features (cohort override)
-- or via direct UPDATE during a transitional period.
-- =============================================================================

UPDATE "user"
SET "beta_cohort" = 'beta_2026'
WHERE "beta_cohort" IS NULL;
