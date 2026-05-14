import "server-only";

import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { requireHouseholdMember } from "@/lib/auth/session";
import { households, meals, recipeShares, users } from "@/db/schema";
import { getServerEnv } from "@/lib/env/server";
import { requireFeatureAccess } from "@/lib/gates/resolver";
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
  const [meal] = await db
    .select({
      id: meals.id,
      householdId: meals.householdId,
      archivedAt: meals.archivedAt
    })
    .from(meals)
    .where(eq(meals.id, args.mealId))
    .limit(1);
  if (!meal) throw new Error("Meal not found.");
  if (meal.archivedAt) throw new Error("Meal is archived.");

  await requireHouseholdMember(args.userId, meal.householdId);
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
    .select({ id: meals.id, householdId: meals.householdId })
    .from(meals)
    .where(eq(meals.id, args.mealId))
    .limit(1);
  if (!meal) throw new Error("Meal not found.");
  await requireHouseholdMember(args.userId, meal.householdId);

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
  const [share] = await db
    .select({
      id: recipeShares.id,
      householdId: recipeShares.householdId,
      revokedAt: recipeShares.revokedAt
    })
    .from(recipeShares)
    .where(eq(recipeShares.id, args.shareId))
    .limit(1);
  if (!share) throw new Error("Share not found.");
  await requireHouseholdMember(args.userId, share.householdId);
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
