import "server-only";

import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { requireHouseholdMember } from "@/lib/auth/session";
import {
  households,
  meals,
  planDishes,
  planShares,
  plans,
  recipeShares,
  users
} from "@/db/schema";
import { getServerEnv } from "@/lib/env/server";
import { requireFeatureAccess } from "@/lib/gates/resolver";
import { getUserSettings } from "@/services/user-settings";
import { logger } from "@/lib/observability/logger";

/**
 * Round 7 — public recipe share links.
 *
 * Creation is gated (`recipe_share_create`, default `beta_or_paid`).
 * Viewing is open: `getRecipeShareByToken` performs NO auth check; the
 * token itself is the access control. Match the contract by NEVER
 * logging the token unredacted.
 *
 * The view reflects current recipe state. Updating a recipe updates the
 * public page too. No snapshot for v1.
 */

function buildShareUrl(token: string): string {
  const env = getServerEnv();
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}/share/${token}`;
}

export type CreatedShare = {
  shareId: string;
  token: string;
  url: string;
};

/**
 * Generate (or surface existing) share link for a meal. Idempotent on
 * the (meal, non-revoked) tuple — if an active share already exists, we
 * return that instead of stacking duplicates. Revoked shares aren't
 * counted; revoking then re-creating issues a fresh token.
 */
export async function createRecipeShare(args: {
  userId: string;
  mealId: string;
}): Promise<CreatedShare> {
  // Look up the meal first so we know which household to authorize
  // against. archivedAt filter rejects soft-deleted meals up front;
  // sharing a meal you can't view yourself would be confusing.
  //
  // R32 — public share links are an independent visibility mechanism
  // (external viewers see the recipe through the token regardless of
  // household sharing state). But CREATING a share is a write that
  // implicitly publishes recipe content, so it's creator-only. Other
  // household members can view a meal that's shared with them but
  // can't publish it externally.
  const [meal] = await db
    .select({
      id: meals.id,
      householdId: meals.householdId,
      archivedAt: meals.archivedAt,
      createdByUserId: meals.createdByUserId
    })
    .from(meals)
    .where(eq(meals.id, args.mealId))
    .limit(1);
  if (!meal) throw new Error("Meal not found.");
  if (meal.archivedAt) throw new Error("Meal is archived.");

  await requireHouseholdMember(args.userId, meal.householdId);
  if (meal.createdByUserId !== args.userId) {
    throw new Error("Only the creator can share this recipe.");
  }
  if (!(await getUserSettings(args.userId)).allowLinkShares) {
    throw new Error("Link sharing is turned off in your settings.");
  }
  await requireFeatureAccess(args.userId, "recipe_share_create");

  // Reuse the existing active share if one exists. Avoids cluttering
  // the listing with duplicates and lets the UI render a single
  // canonical "Copy link" affordance.
  const [existing] = await db
    .select({ id: recipeShares.id, token: recipeShares.token })
    .from(recipeShares)
    .where(
      and(
        eq(recipeShares.mealId, args.mealId),
        isNull(recipeShares.revokedAt)
      )
    )
    .limit(1);
  if (existing) {
    return {
      shareId: existing.id,
      token: existing.token,
      url: buildShareUrl(existing.token)
    };
  }

  const token = randomBytes(32).toString("base64url");

  const [created] = await db
    .insert(recipeShares)
    .values({
      mealId: args.mealId,
      householdId: meal.householdId,
      token,
      createdByUserId: args.userId
    })
    .returning({ id: recipeShares.id });
  if (!created) throw new Error("Couldn't create share link.");

  // Audit log explicitly excludes the token to keep it out of log
  // aggregators. The shareId + mealId are the durable identifiers.
  logger.info("recipe_share_created", {
    userId: args.userId,
    shareId: created.id,
    mealId: args.mealId,
    householdId: meal.householdId
  });

  return {
    shareId: created.id,
    token,
    url: buildShareUrl(token)
  };
}

export type PublicShareView = {
  shareId: string;
  mealName: string;
  recipeText: string | null;
  recipeSourceUrl: string | null;
  photoUrl: string | null;
  householdName: string;
  createdAt: Date;
};

/**
 * Public lookup. NO AUTH check — knowing the token is the access. Joins
 * meal + household for the rendering payload. Returns null for unknown
 * tokens, revoked shares, or archived meals — the route renders the
 * "no longer shared" page for all three.
 */
export async function getRecipeShareByToken(args: {
  token: string;
}): Promise<PublicShareView | null> {
  const [row] = await db
    .select({
      shareId: recipeShares.id,
      revokedAt: recipeShares.revokedAt,
      createdAt: recipeShares.createdAt,
      mealName: meals.name,
      recipeText: meals.recipeText,
      recipeSourceUrl: meals.recipeSourceUrl,
      photoUrl: meals.photoUrl,
      archivedAt: meals.archivedAt,
      householdName: households.name
    })
    .from(recipeShares)
    .innerJoin(meals, eq(meals.id, recipeShares.mealId))
    .innerJoin(households, eq(households.id, recipeShares.householdId))
    .where(eq(recipeShares.token, args.token))
    .limit(1);
  if (!row) return null;
  if (row.revokedAt) return null;
  if (row.archivedAt) return null;

  return {
    shareId: row.shareId,
    mealName: row.mealName,
    recipeText: row.recipeText,
    recipeSourceUrl: row.recipeSourceUrl,
    photoUrl: row.photoUrl,
    householdName: row.householdName,
    createdAt: row.createdAt
  };
}

export type ShareListRow = {
  id: string;
  mealId: string;
  token: string;
  url: string;
  mealName: string;
  createdAt: Date;
  createdByName: string | null;
};

/**
 * List active shares for ONE meal. Used by the share dialog to detect
 * an existing link and surface it instead of generating a new one.
 */
export async function listSharesForMeal(args: {
  userId: string;
  mealId: string;
}): Promise<ShareListRow[]> {
  const [meal] = await db
    .select({
      id: meals.id,
      householdId: meals.householdId,
      createdByUserId: meals.createdByUserId
    })
    .from(meals)
    .where(eq(meals.id, args.mealId))
    .limit(1);
  if (!meal) throw new Error("Meal not found.");
  await requireHouseholdMember(args.userId, meal.householdId);
  // R32 — listing share links for a meal is only relevant to the
  // creator (only they can create / revoke). Returning an empty list
  // for non-creators rather than throwing keeps the dialog simple —
  // the create button is the only path that exposes the creator-only
  // error, and that's gated client-side too.
  if (meal.createdByUserId !== args.userId) {
    return [];
  }

  const rows = await db
    .select({
      id: recipeShares.id,
      mealId: recipeShares.mealId,
      token: recipeShares.token,
      mealName: meals.name,
      createdAt: recipeShares.createdAt,
      createdByName: users.name
    })
    .from(recipeShares)
    .innerJoin(meals, eq(meals.id, recipeShares.mealId))
    .leftJoin(users, eq(users.id, recipeShares.createdByUserId))
    .where(
      and(
        eq(recipeShares.mealId, args.mealId),
        isNull(recipeShares.revokedAt)
      )
    )
    .orderBy(desc(recipeShares.createdAt));

  return rows.map((r) => ({
    id: r.id,
    mealId: r.mealId,
    token: r.token,
    url: buildShareUrl(r.token),
    mealName: r.mealName,
    createdAt: r.createdAt,
    createdByName: r.createdByName
  }));
}

/**
 * List active shares for a household (settings / management view).
 * Eagerly loads meal name + creator for the UI. The mealId is the
 * navigable surface ("revoke this share" links here).
 */
export async function listSharesForHousehold(args: {
  userId: string;
  householdId: string;
}): Promise<ShareListRow[]> {
  await requireHouseholdMember(args.userId, args.householdId);

  const rows = await db
    .select({
      id: recipeShares.id,
      mealId: recipeShares.mealId,
      token: recipeShares.token,
      mealName: meals.name,
      createdAt: recipeShares.createdAt,
      createdByName: users.name
    })
    .from(recipeShares)
    .innerJoin(meals, eq(meals.id, recipeShares.mealId))
    .leftJoin(users, eq(users.id, recipeShares.createdByUserId))
    .where(
      and(
        eq(recipeShares.householdId, args.householdId),
        isNull(recipeShares.revokedAt)
      )
    )
    .orderBy(desc(recipeShares.createdAt));

  return rows.map((r) => ({
    id: r.id,
    mealId: r.mealId,
    token: r.token,
    url: buildShareUrl(r.token),
    mealName: r.mealName,
    createdAt: r.createdAt,
    createdByName: r.createdByName
  }));
}

/**
 * Mark a share revoked. The token becomes a 404 from the public lookup
 * immediately. Any cached WhatsApp / iMessage previews persist until
 * those platforms re-fetch — that's not in our control.
 */
export async function revokeRecipeShare(args: {
  userId: string;
  shareId: string;
}): Promise<void> {
  // Look up the share to find its household, then verify membership.
  // Already-revoked shares are a soft no-op (don't error if the user
  // double-clicked).
  //
  // R32 — revoking is the symmetric write of creating, so it's also
  // creator-only. We join meals to get the creator pointer in one
  // round-trip.
  const [share] = await db
    .select({
      id: recipeShares.id,
      householdId: recipeShares.householdId,
      revokedAt: recipeShares.revokedAt,
      createdByUserId: meals.createdByUserId
    })
    .from(recipeShares)
    .innerJoin(meals, eq(meals.id, recipeShares.mealId))
    .where(eq(recipeShares.id, args.shareId))
    .limit(1);
  if (!share) throw new Error("Share not found.");
  await requireHouseholdMember(args.userId, share.householdId);
  if (share.createdByUserId !== args.userId) {
    throw new Error("Only the creator can revoke this share.");
  }
  if (share.revokedAt) return;

  await db
    .update(recipeShares)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(recipeShares.id, args.shareId));
  logger.info("recipe_share_revoked", {
    userId: args.userId,
    shareId: args.shareId,
    householdId: share.householdId
  });
}

/* ─── Plan link shares (mirror of recipe shares) ──────────────────── */

export type CreatedPlanShare = { shareId: string; token: string; url: string };

export async function createPlanShare(args: {
  userId: string;
  planId: string;
}): Promise<CreatedPlanShare> {
  const [plan] = await db
    .select({
      id: plans.id,
      householdId: plans.householdId,
      archivedAt: plans.archivedAt,
      createdByUserId: plans.createdByUserId
    })
    .from(plans)
    .where(eq(plans.id, args.planId))
    .limit(1);
  if (!plan) throw new Error("Plan not found.");
  if (plan.archivedAt) throw new Error("Plan is archived.");
  await requireHouseholdMember(args.userId, plan.householdId);
  if (plan.createdByUserId !== args.userId) {
    throw new Error("Only the owner can share this plan.");
  }
  if (!(await getUserSettings(args.userId)).allowLinkShares) {
    throw new Error("Link sharing is turned off in your settings.");
  }
  await requireFeatureAccess(args.userId, "recipe_share_create");

  const [existing] = await db
    .select({ id: planShares.id, token: planShares.token })
    .from(planShares)
    .where(and(eq(planShares.planId, args.planId), isNull(planShares.revokedAt)))
    .limit(1);
  if (existing) {
    return { shareId: existing.id, token: existing.token, url: buildShareUrl(existing.token) };
  }

  const token = randomBytes(32).toString("base64url");
  const [created] = await db
    .insert(planShares)
    .values({
      planId: args.planId,
      householdId: plan.householdId,
      token,
      createdByUserId: args.userId
    })
    .returning({ id: planShares.id });
  return { shareId: created!.id, token, url: buildShareUrl(token) };
}

export async function revokePlanShare(args: {
  userId: string;
  shareId: string;
}): Promise<void> {
  const [share] = await db
    .select({
      id: planShares.id,
      revokedAt: planShares.revokedAt,
      createdByUserId: plans.createdByUserId
    })
    .from(planShares)
    .innerJoin(plans, eq(plans.id, planShares.planId))
    .where(eq(planShares.id, args.shareId))
    .limit(1);
  if (!share) throw new Error("Share not found.");
  if (share.createdByUserId !== args.userId) {
    throw new Error("Only the owner can revoke this share.");
  }
  if (share.revokedAt) return;
  await db
    .update(planShares)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(planShares.id, args.shareId));
}

export async function activePlanShareForPlan(args: {
  userId: string;
  planId: string;
}): Promise<{ shareId: string; url: string } | null> {
  const [plan] = await db
    .select({ householdId: plans.householdId })
    .from(plans)
    .where(eq(plans.id, args.planId))
    .limit(1);
  if (!plan) return null;
  await requireHouseholdMember(args.userId, plan.householdId);
  const [row] = await db
    .select({ id: planShares.id, token: planShares.token })
    .from(planShares)
    .where(and(eq(planShares.planId, args.planId), isNull(planShares.revokedAt)))
    .limit(1);
  if (!row) return null;
  return { shareId: row.id, url: buildShareUrl(row.token) };
}

export type PublicPlanView = {
  shareId: string;
  planName: string;
  scheduledDate: string | null;
  notes: string | null;
  householdName: string;
  createdAt: Date;
  dishes: Array<{ name: string; photoUrl: string | null }>;
};

/** Public — NO auth. Token is the access. Returns null when revoked/missing. */
export async function getPlanShareByToken(args: {
  token: string;
}): Promise<PublicPlanView | null> {
  const [row] = await db
    .select({
      shareId: planShares.id,
      revokedAt: planShares.revokedAt,
      createdAt: planShares.createdAt,
      planId: plans.id,
      planName: plans.name,
      scheduledDate: plans.scheduledDate,
      notes: plans.notes,
      archivedAt: plans.archivedAt,
      householdName: households.name
    })
    .from(planShares)
    .innerJoin(plans, eq(plans.id, planShares.planId))
    .innerJoin(households, eq(households.id, planShares.householdId))
    .where(eq(planShares.token, args.token))
    .limit(1);
  if (!row || row.revokedAt || row.archivedAt) return null;

  const dishes = await db
    .select({ name: meals.name, photoUrl: meals.photoUrl })
    .from(planDishes)
    .innerJoin(meals, eq(meals.id, planDishes.mealId))
    .where(eq(planDishes.planId, row.planId))
    .orderBy(asc(planDishes.sortOrder));

  return {
    shareId: row.shareId,
    planName: row.planName,
    scheduledDate: row.scheduledDate,
    notes: row.notes,
    householdName: row.householdName,
    createdAt: row.createdAt,
    dishes
  };
}
