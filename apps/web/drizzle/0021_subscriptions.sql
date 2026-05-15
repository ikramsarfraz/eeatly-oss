-- =============================================================================
-- 0021_subscriptions.sql — Round 6 Stripe paid tier + beta cohort extension
-- =============================================================================
-- Five concerns in one file because they're interlocked:
--   1. `beta_2026` cohort enum value — used by Task 4's backfill UPDATE
--      (separate migration to keep that statement self-contained, since
--      ALTER TYPE in Postgres has constraints around when new values are
--      usable post-add).
--   2. `subscription_status` enum mirroring Stripe's exact status values.
--   3. `subscriptions` table — one row per user, joined to Stripe customer
--      + subscription identifiers.
--   4. `users` denormalization — `stripe_customer_id`,
--      `subscription_status`, `subscription_current_period_end` so the
--      gate resolver doesn't join `subscriptions` on every page load.
--   5. `stripe_webhook_receipts` — idempotency log keyed by Stripe event
--      id (matches Resend's pattern).
--
-- DENORMALIZATION NOTE: the duplicate `subscription_status` on `users`
-- could drift from `subscriptions.status` if a webhook fails mid-write.
-- Task 3's webhook handler writes both inside one transaction; if a
-- drift ever lands in prod, an admin "reconcile subscription" tool is
-- the right fix (flagged in the Round 6 spec).
--
-- Rollback (rarely): drop subscriptions + receipts tables, drop users
-- columns, drop the subscription_status enum. The `beta_2026` enum value
-- can't be removed from Postgres without dropping the enum entirely —
-- forward-only.
-- =============================================================================

-- Step 1: extend the beta_cohort enum so Task 4's backfill UPDATE has
-- the value available. Postgres requires the new value to be committed
-- before it can be referenced; the breakpoint ensures that.
ALTER TYPE "beta_cohort" ADD VALUE IF NOT EXISTS 'beta_2026';
--> statement-breakpoint

-- Step 2: subscription_status enum mirroring Stripe's status values.
-- DO NOT REORDER. Mirrors the strings Stripe sends in the
-- `customer.subscription.*` events.
CREATE TYPE "subscription_status" AS ENUM (
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'trialing',
  'unpaid'
);
--> statement-breakpoint

-- Step 3: subscriptions table.
CREATE TABLE "subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "stripe_customer_id" text NOT NULL,
  "stripe_subscription_id" text,
  "status" "subscription_status" NOT NULL,
  "price_id" text,
  "current_period_start" timestamp with time zone,
  "current_period_end" timestamp with time zone,
  "cancel_at_period_end" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "subscriptions_stripe_customer_id_unique" UNIQUE ("stripe_customer_id")
);
--> statement-breakpoint

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

CREATE INDEX "subscriptions_user_id_idx"
  ON "subscriptions" USING btree ("user_id");
--> statement-breakpoint

-- Step 4: denormalized columns on users for the gate resolver hot path.
ALTER TABLE "user" ADD COLUMN "stripe_customer_id" text;
--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_stripe_customer_id_unique"
  UNIQUE ("stripe_customer_id");
--> statement-breakpoint

ALTER TABLE "user" ADD COLUMN "subscription_status" "subscription_status";
--> statement-breakpoint

ALTER TABLE "user" ADD COLUMN "subscription_current_period_end"
  timestamp with time zone;
--> statement-breakpoint

-- Step 5: Stripe webhook receipt log. Keyed by the Stripe event id
-- (text, not uuid) so the upsert-on-replay is trivial. Same shape as
-- `resend_webhook_receipts`.
CREATE TABLE "stripe_webhook_receipts" (
  "id" text PRIMARY KEY NOT NULL,
  "event_type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "processed_at" timestamp with time zone,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint

CREATE INDEX "stripe_webhook_receipts_event_type_idx"
  ON "stripe_webhook_receipts" USING btree ("event_type");
