-- =============================================================================
-- 0037_tiers_and_credits.sql — second subscription tier + AI credit metering
-- =============================================================================
-- Adds:
--   - subscriptions.tier  : 'plus' | 'pro' (resolved from the Stripe price id
--                           at webhook time). Null = unknown/legacy price.
--   - ai_credits          : per-user credit balance (monthly grant + topups).
--   - ai_credit_ledger    : append-only audit of every credit movement.
--
-- Rollback:
--   DROP TABLE IF EXISTS "ai_credit_ledger";
--   DROP TABLE IF EXISTS "ai_credits";
--   ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "tier";
-- =============================================================================

ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "tier" text;

CREATE TABLE IF NOT EXISTS "ai_credits" (
  "user_id" text PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "monthly_remaining" integer NOT NULL DEFAULT 0,
  "monthly_period_start" timestamptz NOT NULL DEFAULT now(),
  "topup_remaining" integer NOT NULL DEFAULT 0,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "ai_credit_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "delta" integer NOT NULL,
  "reason" text NOT NULL,
  "operation" text,
  "stripe_event_id" text,
  "balance_after" integer,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "ai_credit_ledger_user_created_idx"
  ON "ai_credit_ledger" ("user_id", "created_at");

-- One ledger row per Stripe event (purchase idempotency). NULLs are
-- distinct in a Postgres unique index, so non-purchase rows are unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS "ai_credit_ledger_stripe_event_idx"
  ON "ai_credit_ledger" ("stripe_event_id");
