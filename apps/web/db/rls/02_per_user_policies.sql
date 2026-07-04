-- =============================================================================
-- RLS phase 2 — per-user tables
-- =============================================================================
-- Simplest class: rows belong to exactly one user. Policy is symmetric for
-- read + write (FOR ALL), so the restricted role can only ever touch its own
-- rows. Apply + run the integration test before moving to phase 3.
--
-- Prereq: 01_roles_and_helpers.sql applied. Run as the table owner.
-- =============================================================================

-- Directly user-owned ---------------------------------------------------------
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications FORCE ROW LEVEL SECURITY;
CREATE POLICY notifications_self ON notifications FOR ALL
  USING (user_id = app_current_user())
  WITH CHECK (user_id = app_current_user());

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_self ON subscriptions FOR ALL
  USING (user_id = app_current_user())
  WITH CHECK (user_id = app_current_user());

ALTER TABLE ai_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_credits FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_credits_self ON ai_credits FOR ALL
  USING (user_id = app_current_user())
  WITH CHECK (user_id = app_current_user());

ALTER TABLE ai_credit_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_credit_ledger FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_credit_ledger_self ON ai_credit_ledger FOR ALL
  USING (user_id = app_current_user())
  WITH CHECK (user_id = app_current_user());

ALTER TABLE beta_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_feedback FORCE ROW LEVEL SECURITY;
CREATE POLICY beta_feedback_self ON beta_feedback FOR ALL
  USING (user_id = app_current_user())
  WITH CHECK (user_id = app_current_user());

ALTER TABLE email_delivery_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_delivery_logs FORCE ROW LEVEL SECURITY;
CREATE POLICY email_delivery_logs_self ON email_delivery_logs FOR ALL
  USING (user_id = app_current_user())
  WITH CHECK (user_id = app_current_user());

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY user_settings_self ON user_settings FOR ALL
  USING (user_id = app_current_user())
  WITH CHECK (user_id = app_current_user());

-- ai_usage_events: user_id is NULLABLE — system metering inserts rows with a
-- null user via the PRIVILEGED connection. Under the restricted role a user
-- sees/writes only their own; null-user rows are invisible to app users.
ALTER TABLE ai_usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_usage_events FORCE ROW LEVEL SECURITY;
CREATE POLICY ai_usage_events_self ON ai_usage_events FOR ALL
  USING (user_id = app_current_user())
  WITH CHECK (user_id = app_current_user());

-- Refine drafts are per-user (household members do NOT share drafts) ----------
ALTER TABLE refine_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE refine_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY refine_sessions_self ON refine_sessions FOR ALL
  USING (user_id = app_current_user())
  WITH CHECK (user_id = app_current_user());

-- Children scope through their session. The subquery runs under the restricted
-- role, so refine_sessions' own policy already limits it to the caller's
-- sessions; no recursion (these policies never reference their own table).
ALTER TABLE refine_turns ENABLE ROW LEVEL SECURITY;
ALTER TABLE refine_turns FORCE ROW LEVEL SECURITY;
CREATE POLICY refine_turns_via_session ON refine_turns FOR ALL
  USING (session_id IN (SELECT id FROM refine_sessions WHERE user_id = app_current_user()))
  WITH CHECK (session_id IN (SELECT id FROM refine_sessions WHERE user_id = app_current_user()));

ALTER TABLE refine_pending_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE refine_pending_changes FORCE ROW LEVEL SECURITY;
CREATE POLICY refine_pending_changes_via_session ON refine_pending_changes FOR ALL
  USING (session_id IN (SELECT id FROM refine_sessions WHERE user_id = app_current_user()))
  WITH CHECK (session_id IN (SELECT id FROM refine_sessions WHERE user_id = app_current_user()));
