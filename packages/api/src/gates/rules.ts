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
  "pro_only",
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
  /**
   * Effective billing tier — computed by the resolver from the active
   * subscription OR the no-card first-time Pro trial (see
   * `lib/pricing.ts#resolveTier`). This, not `subscriptionStatus`, is what
   * the paid/pro rule evaluators key off so a trial user is treated as Pro.
   */
  tier: "free" | "plus" | "premium" | "pro";
  /** Allowlist user ids supplied per-feature via overrides. */
  allowlistedUserIds: string[];
  /** Env-flag rule consults this — feature key → boolean. */
  envFlags: Record<string, boolean>;
  /**
   * Release-v1 launch promo. When true, the resolver grants any feature
   * whose default rule is `paid_only` / `beta_or_paid` to every user —
   * Plus is free for all during launch. Handled in the resolver's
   * default-rule step (NOT a rule evaluator), so explicit per-user /
   * per-cohort override rows still win. See `lib/gates/resolver.ts`.
   */
  launchFreeAccess: boolean;
};

/**
 * Rule evaluators. Each returns `true` to grant access, `false` to deny.
 * The resolver runs them only as the "default" — explicit per-user
 * overrides bypass this layer.
 */
export const ruleEvaluators: Record<GateRule, (ctx: GateContext, feature: string) => boolean> = {
  // Any paid tier (the no-card trial counts as Pro). Keyed off the resolved
  // tier so the trial unlocks paid features without a Stripe subscription.
  // Covers Chef / Head Chef / Master Chef.
  paid_only: (ctx) => ctx.tier !== "free",
  // Master Chef only — co-editing, plan sharing, and other top-tier perks.
  // (Priority AI is Head-Chef-and-up, enforced in the AI rate limiter, not a
  // gate rule.)
  pro_only: (ctx) => ctx.tier === "pro",
  beta_or_paid: (ctx) => ctx.betaCohort !== null || ctx.tier !== "free",
  admin_only: (ctx) => ctx.role === "platform_admin",
  allowlist: (ctx) => ctx.allowlistedUserIds.includes(ctx.userId),
  env_flag: (ctx, feature) => Boolean(ctx.envFlags[feature]),
  open: () => true
};
