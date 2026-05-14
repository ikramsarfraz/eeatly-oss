/**
 * Round 6 — feature-gate rule kinds. A `GateRule` is the declarative shape
 * a feature uses as its default; the resolver walks each gate input (admin
 * role, override, cohort, subscription, env flag) and short-circuits when
 * a higher-precedence input matches. Default rules apply only when nothing
 * upstream forced an answer.
 *
 * Rule values are stored as text in `feature_overrides.ruleOverride` —
 * keep the string union here in sync with the table's check constraint
 * (see migration 0020).
 */
export const GATE_RULES = [
  "paid_only",
  "beta_or_paid",
  "admin_only",
  "allowlist",
  "env_flag",
  "open"
] as const;

export type GateRule = (typeof GATE_RULES)[number];

/**
 * Inputs the resolver collects once per request (memoized via React.cache
 * around `loadGateContext`). Pure data; rule evaluators are functions of
 * this shape so we can unit-test them without a DB.
 */
export type GateContext = {
  userId: string;
  role: "root_app_user" | "tenant_user" | "platform_admin";
  betaCohort: string | null;
  subscriptionStatus:
    | "active"
    | "past_due"
    | "canceled"
    | "incomplete"
    | "incomplete_expired"
    | "trialing"
    | "unpaid"
    | null;
  /** Allowlist user ids supplied per-feature via overrides. */
  allowlistedUserIds: string[];
  /** Env-flag rule consults this — feature key → boolean. */
  envFlags: Record<string, boolean>;
};

/**
 * Rule evaluators. Each returns `true` to grant access, `false` to deny.
 * The resolver runs them only as the "default" — explicit per-user
 * overrides bypass this layer.
 */
export const ruleEvaluators: Record<GateRule, (ctx: GateContext, feature: string) => boolean> = {
  paid_only: (ctx) =>
    ctx.subscriptionStatus === "active" || ctx.subscriptionStatus === "trialing",
  beta_or_paid: (ctx) =>
    ctx.betaCohort !== null ||
    ctx.subscriptionStatus === "active" ||
    ctx.subscriptionStatus === "trialing",
  admin_only: (ctx) => ctx.role === "platform_admin",
  allowlist: (ctx) => ctx.allowlistedUserIds.includes(ctx.userId),
  env_flag: (ctx, feature) => Boolean(ctx.envFlags[feature]),
  open: () => true
};
