-- =============================================================================
-- RLS phase 4 — meal_logs, sharing/connection tables, caches, admin/auth
-- =============================================================================
-- This phase carries the personal-cook-history policy that structurally closes
-- audit findings #1 and #3 (see docs/audits/isolation-read-audit-2026-06.md),
-- plus the sharing/connection tables, global caches, append-only analytics, and
-- the Better Auth lockdown.
--
-- Prereq: phases 1-3 applied + tested. Run as the table owner.
-- =============================================================================

-- meal_logs: PERSONAL cook history. A log is visible/writable only to the cook.
-- This is what makes ai.ts:106 (latestLog) and refine.ts:97 (effort) return
-- only the viewer's own logs once they run on the restricted role.
-- NOTE: the one intentional household-wide effort read (plans.ts:739, the
-- plan-dish effort modal) must run on the PRIVILEGED connection (phase 5 wiring)
-- to keep its documented behavior.
ALTER TABLE meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY meal_logs_self ON meal_logs FOR ALL
  USING (cooked_by_user_id = app_current_user())
  WITH CHECK (cooked_by_user_id = app_current_user());

-- item_grants: owner and grantee both see a grant; the owner manages it.
-- Admin-grantee re-sharing (cooksCanReshare) is enforced in the service layer;
-- if you move that flow onto the restricted role, widen the write predicate or
-- route it through dbPrivileged.
ALTER TABLE item_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_grants FORCE ROW LEVEL SECURITY;
CREATE POLICY item_grants_visible ON item_grants FOR SELECT USING (
  owner_user_id = app_current_user() OR grantee_user_id = app_current_user()
);
CREATE POLICY item_grants_owner_write ON item_grants FOR INSERT WITH CHECK (
  owner_user_id = app_current_user()
);
CREATE POLICY item_grants_owner_update ON item_grants FOR UPDATE USING (
  owner_user_id = app_current_user()
) WITH CHECK (owner_user_id = app_current_user());
CREATE POLICY item_grants_owner_delete ON item_grants FOR DELETE USING (
  owner_user_id = app_current_user()
);

-- item_requests: requester creates; both sides see; owner resolves.
ALTER TABLE item_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY item_requests_visible ON item_requests FOR SELECT USING (
  requester_user_id = app_current_user() OR owner_user_id = app_current_user()
);
CREATE POLICY item_requests_create ON item_requests FOR INSERT WITH CHECK (
  requester_user_id = app_current_user()
);
CREATE POLICY item_requests_owner_resolve ON item_requests FOR UPDATE USING (
  owner_user_id = app_current_user()
) WITH CHECK (owner_user_id = app_current_user());

-- share_tombstones: recipient-side. They read + dismiss; the INSERT (on revoke)
-- happens on the PRIVILEGED connection inside the revoke transaction.
ALTER TABLE share_tombstones ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_tombstones FORCE ROW LEVEL SECURITY;
CREATE POLICY share_tombstones_grantee ON share_tombstones FOR SELECT USING (
  grantee_user_id = app_current_user()
);
CREATE POLICY share_tombstones_dismiss ON share_tombstones FOR UPDATE USING (
  grantee_user_id = app_current_user()
) WITH CHECK (grantee_user_id = app_current_user());

-- connections: symmetric. Either side reads; either side can disconnect.
-- Creation happens on accept (token flow) via the PRIVILEGED connection.
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections FORCE ROW LEVEL SECURITY;
CREATE POLICY connections_visible ON connections FOR SELECT USING (
  user_low_id = app_current_user() OR user_high_id = app_current_user()
);
CREATE POLICY connections_disconnect ON connections FOR DELETE USING (
  user_low_id = app_current_user() OR user_high_id = app_current_user()
);

-- connection_invitations: inviter creates + sees. Accept-by-token is privileged.
ALTER TABLE connection_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE connection_invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY connection_invitations_inviter ON connection_invitations FOR ALL
  USING (inviter_user_id = app_current_user())
  WITH CHECK (inviter_user_id = app_current_user());

-- Global caches: world-readable to any app session; writes are privileged
-- (generation / server-side fetch). No write policy → app role can read, not
-- write.
ALTER TABLE dish_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE dish_images FORCE ROW LEVEL SECURITY;
CREATE POLICY dish_images_read ON dish_images FOR SELECT USING (true);

ALTER TABLE url_previews ENABLE ROW LEVEL SECURITY;
ALTER TABLE url_previews FORCE ROW LEVEL SECURITY;
CREATE POLICY url_previews_read ON url_previews FOR SELECT USING (true);

-- feature_overrides: the gate resolver (requireFeatureAccess) reads this on the
-- restricted role. A user may read their own override + any global/cohort
-- override (user_id IS NULL). Writes are admin → privileged.
ALTER TABLE feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_overrides FORCE ROW LEVEL SECURITY;
CREATE POLICY feature_overrides_read ON feature_overrides FOR SELECT USING (
  user_id = app_current_user() OR user_id IS NULL
);

-- analytics_events: append-only for the app (fire-and-forget tracking). The app
-- can INSERT its own events but cannot read them back; admin reads via the
-- privileged connection.
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events FORCE ROW LEVEL SECURITY;
CREATE POLICY analytics_events_append ON analytics_events FOR INSERT WITH CHECK (true);

-- Pure system tables: RLS on, NO policy → the restricted role has no access.
-- These are only touched by the privileged connection (webhooks).
ALTER TABLE stripe_webhook_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_webhook_receipts FORCE ROW LEVEL SECURITY;
ALTER TABLE resend_webhook_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE resend_webhook_receipts FORCE ROW LEVEL SECURITY;

-- Better Auth tables -----------------------------------------------------------
-- Better Auth uses the PRIVILEGED connection (lib/auth/index.ts). The restricted
-- role must never read session tokens or password hashes, so revoke its access
-- to the secret-bearing tables outright.
REVOKE ALL ON session, account, verification FROM eeatly_app;

-- `user` stays readable by the app role because authenticated queries join it
-- for display names ("Ayesha's recipe", owner/grantee labels). RESIDUAL: the
-- app role can read every user row (incl. email). Optional hardening, if the
-- product can live without DB-side email reads on the restricted role:
--   REVOKE ALL ON "user" FROM eeatly_app;
--   GRANT SELECT (id, name, image, email_verified, role, created_at)
--     ON "user" TO eeatly_app;
-- (Self-email reads then come from the Better Auth session object, which already
-- carries it, or via the privileged connection.)
