import "server-only";

import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { featureOverrides, users } from "@/db/schema";
import { logger } from "@/lib/observability/logger";
import { FEATURE_REGISTRY, type FeatureKey } from "@/lib/gates/registry";
import { GATE_RULES, type GateRule } from "@/lib/gates/rules";

/**
 * Round 6 — admin-only CRUD for `feature_overrides`. Callers gate access
 * via `requirePlatformAdmin()` BEFORE invoking these — the service
 * doesn't re-check (mirrors the existing `services/analytics.ts` pattern
 * where admin services trust their callers).
 */

export type FeatureSummary = {
  feature: FeatureKey;
  description: string;
  defaultRule: GateRule;
  overrideCount: number;
};

export async function listFeaturesWithCounts(): Promise<FeatureSummary[]> {
  const rows = await db
    .select({
      featureKey: featureOverrides.featureKey,
      value: count(featureOverrides.id)
    })
    .from(featureOverrides)
    .groupBy(featureOverrides.featureKey);

  const counts = new Map(rows.map((r) => [r.featureKey, Number(r.value)]));
  return (Object.keys(FEATURE_REGISTRY) as FeatureKey[]).map((feature) => ({
    feature,
    description: FEATURE_REGISTRY[feature].description,
    defaultRule: FEATURE_REGISTRY[feature].defaultRule,
    overrideCount: counts.get(feature) ?? 0
  }));
}

export type OverrideRow = {
  id: string;
  featureKey: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  cohort: string | null;
  ruleOverride: GateRule;
  createdAt: Date;
};

export async function listOverridesForFeature(feature: FeatureKey): Promise<OverrideRow[]> {
  const rows = await db
    .select({
      id: featureOverrides.id,
      featureKey: featureOverrides.featureKey,
      userId: featureOverrides.userId,
      userName: users.name,
      userEmail: users.email,
      cohort: featureOverrides.cohort,
      ruleOverride: featureOverrides.ruleOverride,
      createdAt: featureOverrides.createdAt
    })
    .from(featureOverrides)
    .leftJoin(users, eq(users.id, featureOverrides.userId))
    .where(eq(featureOverrides.featureKey, feature))
    .orderBy(desc(featureOverrides.createdAt));

  return rows.map((r) => ({ ...r, ruleOverride: r.ruleOverride as GateRule }));
}

export type CreateOverrideArgs = {
  feature: FeatureKey;
  ruleOverride: GateRule;
  /** Exactly one of `userId` or `cohort` must be provided. */
  userId?: string;
  cohort?: string;
  createdByUserId: string;
};

export async function createOverride(args: CreateOverrideArgs): Promise<{ id: string }> {
  // Validate the XOR at the service so we return a clean error before
  // hitting the DB CHECK constraint (which would surface as a generic
  // 23514 violation). One of them must be set; not both.
  const hasUser = Boolean(args.userId);
  const hasCohort = Boolean(args.cohort);
  if (hasUser === hasCohort) {
    throw new Error("Override must target exactly one of user or cohort.");
  }
  if (!GATE_RULES.includes(args.ruleOverride)) {
    throw new Error(`Unknown rule "${args.ruleOverride}".`);
  }

  // If a row already exists for this (feature, target), upsert it so the
  // admin UI doesn't accumulate duplicates as the rule gets re-applied.
  // Two predicate paths — user-targeted vs cohort-targeted — handled
  // separately so we can use the right index.
  const existingClause = args.userId
    ? and(
        eq(featureOverrides.featureKey, args.feature),
        eq(featureOverrides.userId, args.userId)
      )
    : and(
        eq(featureOverrides.featureKey, args.feature),
        eq(featureOverrides.cohort, args.cohort!)
      );
  const [existing] = await db
    .select({ id: featureOverrides.id })
    .from(featureOverrides)
    .where(existingClause)
    .limit(1);

  if (existing) {
    await db
      .update(featureOverrides)
      .set({ ruleOverride: args.ruleOverride })
      .where(eq(featureOverrides.id, existing.id));
    logger.info("feature_override_updated", {
      featureKey: args.feature,
      overrideId: existing.id,
      ruleOverride: args.ruleOverride,
      createdByUserId: args.createdByUserId
    });
    return { id: existing.id };
  }

  const [created] = await db
    .insert(featureOverrides)
    .values({
      featureKey: args.feature,
      userId: args.userId ?? null,
      cohort: args.cohort ?? null,
      ruleOverride: args.ruleOverride,
      createdByUserId: args.createdByUserId
    })
    .returning({ id: featureOverrides.id });
  if (!created) throw new Error("Couldn't create feature override.");
  logger.info("feature_override_created", {
    featureKey: args.feature,
    overrideId: created.id,
    target: args.userId ? `user:${args.userId}` : `cohort:${args.cohort}`,
    ruleOverride: args.ruleOverride,
    createdByUserId: args.createdByUserId
  });
  return created;
}

export async function deleteOverride(args: { id: string; deletedByUserId: string }): Promise<void> {
  const [deleted] = await db
    .delete(featureOverrides)
    .where(eq(featureOverrides.id, args.id))
    .returning({ id: featureOverrides.id });
  if (!deleted) throw new Error("Override not found.");
  logger.info("feature_override_deleted", {
    overrideId: args.id,
    deletedByUserId: args.deletedByUserId
  });
}

/**
 * Admin user-search helper. Used by the "give user X this override" flow.
 * Email prefix match; the result is a tiny list, no pagination.
 */
export async function searchUsersForOverride(q: string, limit = 20) {
  const trimmed = q.trim().toLowerCase();
  if (trimmed.length < 2) return [];
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      betaCohort: users.betaCohort
    })
    .from(users)
    .where(sql`lower(${users.email}) like ${`${trimmed}%`}`)
    .limit(limit);
}
