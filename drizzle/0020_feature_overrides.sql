-- =============================================================================
-- 0020_feature_overrides.sql — Round 6 feature gating per-user overrides
-- =============================================================================
-- New table that the gate resolver consults BEFORE evaluating a feature's
-- default rule. See lib/gates/resolver.ts for the precedence walk:
--   1. admin role          → always allow
--   2. user override       → use ruleOverride
--   3. cohort override     → use ruleOverride
--   4. registry default    → from FEATURE_REGISTRY
--
-- userId / cohort are mutually exclusive — the CHECK constraint enforces
-- exactly one is set. Without it, a single row could shadow either
-- dimension and the precedence logic in the resolver would have to
-- branch differently for the (rare, ambiguous) "both set" case.
--
-- ruleOverride is text, not an enum — keeps the rule set editable from
-- the application without a schema migration. The TS GATE_RULES union
-- (lib/gates/rules.ts) is the source of truth.
--
-- Rollback:
--   DROP TABLE "feature_overrides";
-- =============================================================================

CREATE TABLE "feature_overrides" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "feature_key" text NOT NULL,
  "user_id" text,
  "cohort" text,
  "rule_override" text NOT NULL,
  "created_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "feature_overrides_user_xor_cohort" CHECK (
    ("user_id" IS NULL) <> ("cohort" IS NULL)
  )
);
--> statement-breakpoint

ALTER TABLE "feature_overrides" ADD CONSTRAINT "feature_overrides_user_id_user_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "user"("id")
  ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint

ALTER TABLE "feature_overrides" ADD CONSTRAINT "feature_overrides_created_by_user_id_user_id_fk"
  FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint

CREATE INDEX "feature_overrides_feature_user_idx"
  ON "feature_overrides" USING btree ("feature_key", "user_id");
--> statement-breakpoint

CREATE INDEX "feature_overrides_feature_cohort_idx"
  ON "feature_overrides" USING btree ("feature_key", "cohort");
