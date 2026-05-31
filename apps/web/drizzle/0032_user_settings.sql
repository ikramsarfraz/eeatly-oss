-- =============================================================================
-- 0032_user_settings.sql — per-user sharing & privacy settings
-- =============================================================================
-- One row per user; an absent row means all defaults. Every column is
-- enforced server-side (link-share gating, reshare permission, inbound-invite
-- gating, email discovery), not cosmetic.
--
-- Rollback: DROP TABLE IF EXISTS "user_settings";
-- =============================================================================

CREATE TABLE IF NOT EXISTS "user_settings" (
  "user_id" text PRIMARY KEY REFERENCES "user"("id") ON DELETE CASCADE,
  "allow_link_shares" boolean DEFAULT true NOT NULL,
  "cooks_can_reshare" boolean DEFAULT false NOT NULL,
  "who_can_add_you" text DEFAULT 'connections' NOT NULL,
  "find_by_email" boolean DEFAULT true NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
