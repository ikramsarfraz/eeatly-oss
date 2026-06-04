import "server-only";

import { cache } from "react";
import { and, eq, or } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { featureOverrides, subscriptions, users } from "@/db/schema";
import { isLaunchFreeAccess } from "@/lib/env/server";
import { resolveTier } from "@/lib/pricing";
import { FeatureGateDeniedError } from "@/lib/errors/gates";
import { logger } from "@/lib/observability/logger";
import {
  FEATURE_REGISTRY,
  type FeatureKey
} from "@eeatly/api/gates/registry";
import { ruleEvaluators, type GateContext, type GateRule } from "@eeatly/api/gates/rules";

/**
 * Round 6 — feature-gate resolver. Server-only, memoized per-request.
 *
 * Precedence (first match wins):
 *   1. Admin role            → always allow (no log noise — admins use
 *                              the app like real users; the audit log
 *                              still records the allow)
 *   2. Per-user override     → use this row's `ruleOverride`
 *   3. Per-cohort override   → use this row's `ruleOverride`
 *   4. Feature's default rule → from `FEATURE_REGISTRY`
 *
 * Subscription + cohort gates are evaluated as part of step 4 (the rule
 * evaluator reads `subscriptionStatus` / `betaCohort` from the context).
 * They DON'T override admin or per-user overrides.
 *
 * Every check emits a `gate_check` debug log line. Stays at debug so
 * production traffic isn't drowning in audit lines; flip to info on a
 * specific feature when investigating a bug.
 */

const loadGateContext = cache(async (userId: string): Promise<GateContext> => {
  const [user] = await db
    .select({
      id: users.id,
      role: users.role,
      betaCohort: users.betaCohort,
      subscriptionStatus: users.subscriptionStatus,
      createdAt: users.createdAt,
      complimentaryAccessUntil: users.complimentaryAccessUntil,
      // Tier lives on the subscriptions row (the denormalized user column
      // only carries status). Left join so trial/free users with no row
      // still resolve.
      subscriptionTier: subscriptions.tier
    })
    .from(users)
    .leftJoin(subscriptions, eq(subscriptions.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) {
    // Synthesize a minimal context. The caller hit can() with a userId
    // that doesn't resolve — most rules deny by default, so this is the
    // right shape.
    return {
      userId,
      role: "root_app_user",
      betaCohort: null,
      subscriptionStatus: null,
      tier: "free",
      allowlistedUserIds: [],
      envFlags: {},
      launchFreeAccess: isLaunchFreeAccess()
    };
  }

  // Effective tier folds in the no-card first-time Pro trial (account-age
  // based) so trial users reach paid/pro features without a Stripe row.
  const { tier } = resolveTier({
    subscriptionStatus: user.subscriptionStatus,
    subscriptionTier: user.subscriptionTier,
    createdAt: user.createdAt,
    complimentaryAccessUntil: user.complimentaryAccessUntil,
    now: new Date()
  });

  return {
    userId,
    role: user.role,
    betaCohort: user.betaCohort,
    // After migration 0021, this column is the source of truth for the
    // gate. The Stripe webhook handler keeps it in sync with
    // `subscriptions.status` inside one transaction — drift is
    // theoretical, fixable by a future reconcile tool.
    subscriptionStatus: user.subscriptionStatus,
    tier,
    // Allowlist + env-flag are evaluated per-feature inside `can()` —
    // loading them all up-front would be wasteful for the common case
    // (rules other than `allowlist` / `env_flag`).
    allowlistedUserIds: [],
    envFlags: {},
    // Launch promo flag — read once per request alongside the user row.
    launchFreeAccess: isLaunchFreeAccess()
  };
});

/**
 * Look up overrides for one feature. Returns the matching rule string
 * (user override first, then cohort), or null when none.
 *
 * One query, two predicates (user_id = ? OR cohort = ?) with the feature
 * filter — the composite indexes on (feature_key, user_id) and
 * (feature_key, cohort) cover both predicates.
 */
async function loadOverrideForFeature(
  feature: FeatureKey,
  ctx: GateContext
): Promise<GateRule | null> {
  const userMatch = eq(featureOverrides.userId, ctx.userId);
  const cohortMatch = ctx.betaCohort
    ? eq(featureOverrides.cohort, ctx.betaCohort)
    : undefined;
  const matcher = cohortMatch ? or(userMatch, cohortMatch) : userMatch;

  const rows = await db
    .select({
      userId: featureOverrides.userId,
      cohort: featureOverrides.cohort,
      ruleOverride: featureOverrides.ruleOverride
    })
    .from(featureOverrides)
    .where(and(eq(featureOverrides.featureKey, feature), matcher));

  // User override takes precedence over cohort.
  const userRow = rows.find((r) => r.userId === ctx.userId);
  if (userRow) return userRow.ruleOverride as GateRule;
  const cohortRow = rows.find((r) => r.cohort !== null && r.cohort === ctx.betaCohort);
  if (cohortRow) return cohortRow.ruleOverride as GateRule;
  return null;
}

export async function can(userId: string, feature: FeatureKey): Promise<boolean> {
  const ctx = await loadGateContext(userId);

  // Step 1: admin always wins.
  if (ctx.role === "platform_admin") {
    logger.debug("gate_check", {
      userId,
      feature,
      allowed: true,
      via: "admin"
    });
    return true;
  }

  // Step 2-3: override (user or cohort).
  const override = await loadOverrideForFeature(feature, ctx);
  if (override) {
    const allowed = ruleEvaluators[override](ctx, feature);
    logger.debug("gate_check", {
      userId,
      feature,
      allowed,
      via: "override",
      rule: override
    });
    return allowed;
  }

  // Step 4: feature's default rule.
  const defaultRule = FEATURE_REGISTRY[feature].defaultRule;

  // Launch promo (release v1): unlock the paid-tier default rules for
  // everyone. Runs only after the override lookup, so an explicit
  // per-user / per-cohort deny still wins. Leaves admin_only, allowlist,
  // env_flag, and open untouched.
  if (
    ctx.launchFreeAccess &&
    (defaultRule === "beta_or_paid" || defaultRule === "paid_only")
  ) {
    logger.debug("gate_check", {
      userId,
      feature,
      allowed: true,
      via: "launch"
    });
    return true;
  }

  const allowed = ruleEvaluators[defaultRule](ctx, feature);
  logger.debug("gate_check", {
    userId,
    feature,
    allowed,
    via: "default",
    rule: defaultRule
  });
  return allowed;
}

/**
 * Throw `FeatureGateDeniedError` when the gate denies. Service-layer
 * callers wrap their critical work; actions catch and translate to
 * `{ ok: false; code: 'UPGRADE_REQUIRED'; feature }`.
 */
export async function requireFeatureAccess(
  userId: string,
  feature: FeatureKey
): Promise<void> {
  const allowed = await can(userId, feature);
  if (!allowed) {
    throw new FeatureGateDeniedError(feature);
  }
}

// Re-exports so callers only need `@/lib/gates/resolver`.
export { FeatureGateDeniedError };
export type { FeatureKey };
