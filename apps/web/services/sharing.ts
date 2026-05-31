import "server-only";

import { and, asc, count, desc, eq, inArray, isNull, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db/client";
import {
  connections,
  itemGrants,
  itemRequests,
  mealIngredients,
  meals,
  plans,
  recipeShares,
  recipeSteps,
  shareTombstones,
  users
} from "@/db/schema";
import {
  createNotification,
  createNotificationIfNotRecent
} from "@/services/notifications";
import { getCurrentHousehold } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env/server";
import { normalizeMealName } from "@/lib/utils";
import { logger } from "@/lib/observability/logger";

/**
 * Per-item sharing engine (Phase 1).
 *
 * The access-control core the sharing UI builds on: grant/revoke an item
 * to a person, enumerate who can see an item, list what's shared with me,
 * request a locked item, resolve a request, and read/dismiss tombstones.
 * Forking ("save a copy") lands with the Shared surface in a later phase.
 *
 * Ownership of an item is its `created_by_user_id` (backfilled non-null by
 * migration 0030). Sharing is only allowed between connected users (the
 * sharing circle). Notifications about shares/requests reuse the `system`
 * notification type with a `payload.kind` discriminator so the bell can
 * tag them ('share' | 'request' | 'update' | 'connection_invite') without
 * an enum migration.
 */

export type ItemType = "recipe" | "plan";

type ItemRef = { ownerUserId: string; name: string; householdId: string };

/** Resolve an item to its owner + display name, or null if missing/archived. */
async function resolveItem(itemType: ItemType, itemId: string): Promise<ItemRef | null> {
  if (itemType === "recipe") {
    const [row] = await db
      .select({
        ownerUserId: meals.createdByUserId,
        name: meals.name,
        householdId: meals.householdId,
        archivedAt: meals.archivedAt
      })
      .from(meals)
      .where(eq(meals.id, itemId))
      .limit(1);
    if (!row || row.archivedAt || !row.ownerUserId) return null;
    return { ownerUserId: row.ownerUserId, name: row.name, householdId: row.householdId };
  }
  const [row] = await db
    .select({
      ownerUserId: plans.createdByUserId,
      name: plans.name,
      householdId: plans.householdId,
      archivedAt: plans.archivedAt
    })
    .from(plans)
    .where(eq(plans.id, itemId))
    .limit(1);
  if (!row || row.archivedAt || !row.ownerUserId) return null;
  return { ownerUserId: row.ownerUserId, name: row.name, householdId: row.householdId };
}

/** Canonical (low, high) ordering for the symmetric connections table. */
function connectionPair(a: string, b: string): { low: string; high: string } {
  return a < b ? { low: a, high: b } : { low: b, high: a };
}

/** True if `granteeUserId` holds an active grant for the item. */
export async function hasGrant(
  granteeUserId: string,
  itemType: ItemType,
  itemId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: itemGrants.id })
    .from(itemGrants)
    .where(
      and(
        eq(itemGrants.itemType, itemType),
        eq(itemGrants.itemId, itemId),
        eq(itemGrants.granteeUserId, granteeUserId),
        isNull(itemGrants.revokedAt)
      )
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Of the given recipe ids, the subset the user can access via an active
 * grant (used to compute "locked" dishes on a shared plan). Returns a Set.
 */
export async function accessibleRecipeIds(
  userId: string,
  mealIds: string[]
): Promise<Set<string>> {
  if (mealIds.length === 0) return new Set();
  const rows = await db
    .select({ itemId: itemGrants.itemId })
    .from(itemGrants)
    .where(
      and(
        eq(itemGrants.granteeUserId, userId),
        eq(itemGrants.itemType, "recipe"),
        inArray(itemGrants.itemId, mealIds),
        isNull(itemGrants.revokedAt)
      )
    );
  return new Set(rows.map((r) => r.itemId));
}

/** True if the two users are in each other's sharing circle. */
export async function areConnected(a: string, b: string): Promise<boolean> {
  if (a === b) return false;
  const { low, high } = connectionPair(a, b);
  const [row] = await db
    .select({ id: connections.id })
    .from(connections)
    .where(and(eq(connections.userLowId, low), eq(connections.userHighId, high)))
    .limit(1);
  return Boolean(row);
}

/** Create a connection if one doesn't exist (idempotent). */
export async function ensureConnection(a: string, b: string): Promise<void> {
  if (a === b) return;
  const { low, high } = connectionPair(a, b);
  await db
    .insert(connections)
    .values({ userLowId: low, userHighId: high })
    .onConflictDoNothing({ target: [connections.userLowId, connections.userHighId] });
}

export type ConnectionPerson = {
  userId: string;
  name: string | null;
  email: string;
};

/** The viewer's sharing circle — everyone they're connected to. */
export async function listConnections(userId: string): Promise<ConnectionPerson[]> {
  const lowUser = alias(users, "low_user");
  const highUser = alias(users, "high_user");
  const rows = await db
    .select({
      lowId: connections.userLowId,
      highId: connections.userHighId,
      lowName: lowUser.name,
      lowEmail: lowUser.email,
      highName: highUser.name,
      highEmail: highUser.email
    })
    .from(connections)
    .innerJoin(lowUser, eq(lowUser.id, connections.userLowId))
    .innerJoin(highUser, eq(highUser.id, connections.userHighId))
    .where(or(eq(connections.userLowId, userId), eq(connections.userHighId, userId)));

  return rows.map((r) =>
    r.lowId === userId
      ? { userId: r.highId, name: r.highName, email: r.highEmail }
      : { userId: r.lowId, name: r.lowName, email: r.lowEmail }
  );
}

/**
 * Owner-side share counts for the viewer's recipes — `{ mealId: N }` for the
 * Library "Yours" cards' share button. Only items with ≥1 active grant appear.
 */
export async function getRecipeShareCounts(userId: string): Promise<Record<string, number>> {
  const rows = await db
    .select({ itemId: itemGrants.itemId, count: count() })
    .from(itemGrants)
    .where(
      and(
        eq(itemGrants.ownerUserId, userId),
        eq(itemGrants.itemType, "recipe"),
        isNull(itemGrants.revokedAt)
      )
    )
    .groupBy(itemGrants.itemId);
  const out: Record<string, number> = {};
  for (const r of rows) out[r.itemId] = Number(r.count);
  return out;
}

export type ItemGranteeView = {
  grantId: string;
  granteeUserId: string;
  name: string | null;
  email: string;
  createdAt: string;
};

/** Owner-side: who currently has access to this item. */
export async function listGrantsForItem(args: {
  userId: string;
  itemType: ItemType;
  itemId: string;
}): Promise<ItemGranteeView[]> {
  const item = await resolveItem(args.itemType, args.itemId);
  if (!item) throw new Error("Item not found.");
  if (item.ownerUserId !== args.userId) {
    throw new Error("Only the owner can view sharing for this item.");
  }

  const rows = await db
    .select({
      grantId: itemGrants.id,
      granteeUserId: itemGrants.granteeUserId,
      name: users.name,
      email: users.email,
      createdAt: itemGrants.createdAt
    })
    .from(itemGrants)
    .innerJoin(users, eq(users.id, itemGrants.granteeUserId))
    .where(
      and(
        eq(itemGrants.itemType, args.itemType),
        eq(itemGrants.itemId, args.itemId),
        isNull(itemGrants.revokedAt)
      )
    )
    .orderBy(desc(itemGrants.createdAt));

  return rows.map((r) => ({
    grantId: r.grantId,
    granteeUserId: r.granteeUserId,
    name: r.name,
    email: r.email,
    createdAt: r.createdAt.toISOString()
  }));
}

/**
 * Grant an item to a connected person. Owner-only; idempotent (re-granting
 * a previously-revoked grant un-revokes the same row). Notifies the grantee.
 */
export async function grantItem(args: {
  ownerUserId: string;
  itemType: ItemType;
  itemId: string;
  granteeUserId: string;
}): Promise<{ grantId: string }> {
  if (args.granteeUserId === args.ownerUserId) {
    throw new Error("You already own this item.");
  }
  const item = await resolveItem(args.itemType, args.itemId);
  if (!item) throw new Error("Item not found.");
  if (item.ownerUserId !== args.ownerUserId) {
    throw new Error("Only the owner can share this item.");
  }
  if (!(await areConnected(args.ownerUserId, args.granteeUserId))) {
    throw new Error("You can only share with people in your circle.");
  }

  const [grant] = await db
    .insert(itemGrants)
    .values({
      itemType: args.itemType,
      itemId: args.itemId,
      ownerUserId: args.ownerUserId,
      granteeUserId: args.granteeUserId,
      revokedAt: null
    })
    .onConflictDoUpdate({
      target: [itemGrants.itemType, itemGrants.itemId, itemGrants.granteeUserId],
      // Re-grant: clear any prior revoke, re-stamp ownership + time.
      set: { revokedAt: null, ownerUserId: args.ownerUserId, createdAt: new Date() }
    })
    .returning({ grantId: itemGrants.id });

  const ownerName = await displayName(args.ownerUserId);
  void createNotification({
    userId: args.granteeUserId,
    type: "system",
    title: `${ownerName} shared "${item.name}" with you`,
    href: "/library?surface=shared",
    payload: {
      kind: "share",
      itemType: args.itemType,
      itemId: args.itemId,
      actorUserId: args.ownerUserId
    }
  }).catch((error) => {
    logger.warn("sharing_grant_notification_failed", {
      granteeUserId: args.granteeUserId,
      error: error instanceof Error ? error.message : String(error)
    });
  });

  return { grantId: grant!.grantId };
}

/**
 * Revoke a person's access. Owner-only; idempotent. Writes a tombstone so
 * the recipient sees the live copy was removed (their saved copy, if any,
 * is preserved and referenced).
 */
export async function revokeItem(args: {
  ownerUserId: string;
  itemType: ItemType;
  itemId: string;
  granteeUserId: string;
}): Promise<void> {
  const item = await resolveItem(args.itemType, args.itemId);
  if (!item) throw new Error("Item not found.");
  if (item.ownerUserId !== args.ownerUserId) {
    throw new Error("Only the owner can change sharing for this item.");
  }

  const [grant] = await db
    .select({ id: itemGrants.id, savedCopyItemId: itemGrants.savedCopyItemId })
    .from(itemGrants)
    .where(
      and(
        eq(itemGrants.itemType, args.itemType),
        eq(itemGrants.itemId, args.itemId),
        eq(itemGrants.granteeUserId, args.granteeUserId),
        isNull(itemGrants.revokedAt)
      )
    )
    .limit(1);
  if (!grant) return; // already revoked / never granted — no-op

  await db
    .update(itemGrants)
    .set({ revokedAt: new Date() })
    .where(eq(itemGrants.id, grant.id));

  const ownerName = await displayName(args.ownerUserId);
  await db.insert(shareTombstones).values({
    granteeUserId: args.granteeUserId,
    itemType: args.itemType,
    itemName: item.name,
    ownerUserId: args.ownerUserId,
    ownerName,
    kind: "revoked",
    savedCopyItemId: grant.savedCopyItemId ?? null
  });
}

export type SharedWithMeItem = {
  itemType: ItemType;
  itemId: string;
  name: string;
  ownerUserId: string;
  ownerName: string | null;
  photoUrl: string | null;
  savedCopyItemId: string | null;
  grantedAt: string;
};

/** Grantee-side: the live copies others have shared with me (the Shared surface). */
export async function listSharedWithMe(userId: string): Promise<SharedWithMeItem[]> {
  const recipeRows = await db
    .select({
      itemId: itemGrants.itemId,
      name: meals.name,
      ownerUserId: itemGrants.ownerUserId,
      ownerName: users.name,
      photoUrl: meals.photoUrl,
      savedCopyItemId: itemGrants.savedCopyItemId,
      grantedAt: itemGrants.createdAt
    })
    .from(itemGrants)
    .innerJoin(meals, eq(meals.id, itemGrants.itemId))
    .innerJoin(users, eq(users.id, itemGrants.ownerUserId))
    .where(
      and(
        eq(itemGrants.granteeUserId, userId),
        eq(itemGrants.itemType, "recipe"),
        isNull(itemGrants.revokedAt),
        isNull(meals.archivedAt)
      )
    );

  const planRows = await db
    .select({
      itemId: itemGrants.itemId,
      name: plans.name,
      ownerUserId: itemGrants.ownerUserId,
      ownerName: users.name,
      savedCopyItemId: itemGrants.savedCopyItemId,
      grantedAt: itemGrants.createdAt
    })
    .from(itemGrants)
    .innerJoin(plans, eq(plans.id, itemGrants.itemId))
    .innerJoin(users, eq(users.id, itemGrants.ownerUserId))
    .where(
      and(
        eq(itemGrants.granteeUserId, userId),
        eq(itemGrants.itemType, "plan"),
        isNull(itemGrants.revokedAt),
        isNull(plans.archivedAt)
      )
    );

  const items: SharedWithMeItem[] = [
    ...recipeRows.map((r) => ({
      itemType: "recipe" as const,
      itemId: r.itemId,
      name: r.name,
      ownerUserId: r.ownerUserId,
      ownerName: r.ownerName,
      photoUrl: r.photoUrl,
      savedCopyItemId: r.savedCopyItemId,
      grantedAt: r.grantedAt.toISOString()
    })),
    ...planRows.map((r) => ({
      itemType: "plan" as const,
      itemId: r.itemId,
      name: r.name,
      ownerUserId: r.ownerUserId,
      ownerName: r.ownerName,
      photoUrl: null,
      savedCopyItemId: r.savedCopyItemId,
      grantedAt: r.grantedAt.toISOString()
    }))
  ];
  return items.sort((a, b) => b.grantedAt.localeCompare(a.grantedAt));
}

/**
 * A recipient asks the owner to share a (locked) item — e.g. a co-cook
 * requesting a plan dish's recipe. Notifies the owner with Share-it/Not-now
 * actions. No-op if the requester already has access or owns it.
 */
export async function requestItem(args: {
  requesterUserId: string;
  itemType: ItemType;
  itemId: string;
}): Promise<{ requested: boolean }> {
  const item = await resolveItem(args.itemType, args.itemId);
  if (!item) throw new Error("Item not found.");
  if (item.ownerUserId === args.requesterUserId) return { requested: false };

  // Already have access?
  const [existingGrant] = await db
    .select({ id: itemGrants.id })
    .from(itemGrants)
    .where(
      and(
        eq(itemGrants.itemType, args.itemType),
        eq(itemGrants.itemId, args.itemId),
        eq(itemGrants.granteeUserId, args.requesterUserId),
        isNull(itemGrants.revokedAt)
      )
    )
    .limit(1);
  if (existingGrant) return { requested: false };

  const [request] = await db
    .insert(itemRequests)
    .values({
      itemType: args.itemType,
      itemId: args.itemId,
      requesterUserId: args.requesterUserId,
      ownerUserId: item.ownerUserId,
      status: "pending"
    })
    .onConflictDoNothing()
    .returning({ id: itemRequests.id });

  if (!request) return { requested: true }; // a pending request already existed

  const requesterName = await displayName(args.requesterUserId);
  void createNotification({
    userId: item.ownerUserId,
    type: "system",
    title: `${requesterName} asked you to share "${item.name}"`,
    payload: {
      kind: "request",
      requestId: request.id,
      itemType: args.itemType,
      itemId: args.itemId,
      actorUserId: args.requesterUserId
    }
  }).catch((error) => {
    logger.warn("sharing_request_notification_failed", {
      ownerUserId: item.ownerUserId,
      error: error instanceof Error ? error.message : String(error)
    });
  });

  return { requested: true };
}

/**
 * Owner resolves a pending request: grant it (shares + notifies requester)
 * or decline it. Owner-only.
 */
export async function resolveRequest(args: {
  ownerUserId: string;
  requestId: string;
  action: "grant" | "decline";
}): Promise<void> {
  const [request] = await db
    .select()
    .from(itemRequests)
    .where(eq(itemRequests.id, args.requestId))
    .limit(1);
  if (!request) throw new Error("Request not found.");
  if (request.ownerUserId !== args.ownerUserId) {
    throw new Error("Only the owner can resolve this request.");
  }
  if (request.status !== "pending") return; // already resolved — idempotent

  await db
    .update(itemRequests)
    .set({
      status: args.action === "grant" ? "granted" : "declined",
      resolvedAt: new Date()
    })
    .where(eq(itemRequests.id, request.id));

  if (args.action === "grant") {
    // A requester is, by construction, already connected (they saw a shared
    // plan). Ensure it anyway so the grant's connection check passes.
    await ensureConnection(args.ownerUserId, request.requesterUserId);
    await grantItem({
      ownerUserId: args.ownerUserId,
      itemType: request.itemType as ItemType,
      itemId: request.itemId,
      granteeUserId: request.requesterUserId
    });
  }
}

export type TombstoneView = {
  id: string;
  itemType: ItemType;
  itemName: string;
  ownerName: string | null;
  kind: "revoked" | "deleted";
  savedCopyItemId: string | null;
  createdAt: string;
};

/** Recipient's "Recently removed" strip — active (undismissed) tombstones. */
export async function listTombstones(userId: string): Promise<TombstoneView[]> {
  const rows = await db
    .select()
    .from(shareTombstones)
    .where(
      and(eq(shareTombstones.granteeUserId, userId), isNull(shareTombstones.dismissedAt))
    )
    .orderBy(desc(shareTombstones.createdAt))
    .limit(20);

  return rows.map((r) => ({
    id: r.id,
    itemType: r.itemType as ItemType,
    itemName: r.itemName,
    ownerName: r.ownerName,
    kind: r.kind as "revoked" | "deleted",
    savedCopyItemId: r.savedCopyItemId,
    createdAt: r.createdAt.toISOString()
  }));
}

export async function dismissTombstone(userId: string, tombstoneId: string): Promise<void> {
  await db
    .update(shareTombstones)
    .set({ dismissedAt: new Date() })
    .where(
      and(eq(shareTombstones.id, tombstoneId), eq(shareTombstones.granteeUserId, userId))
    );
}

/**
 * Save a copy ("fork") of a shared recipe into the forker's own library.
 * Creates a new meal they OWN (fully editable, no longer live), copying the
 * core fields + structured ingredients/steps. Records `saved_copy_item_id`
 * on the grant so the same grant never re-forks (returns the existing copy
 * on a second call). Recipes only for now; plan fork is deferred.
 */
export async function forkRecipe(args: {
  forkerUserId: string;
  sourceMealId: string;
}): Promise<{ newMealId: string }> {
  // Must hold an active grant for this recipe.
  const [grant] = await db
    .select({ id: itemGrants.id, savedCopyItemId: itemGrants.savedCopyItemId })
    .from(itemGrants)
    .where(
      and(
        eq(itemGrants.itemType, "recipe"),
        eq(itemGrants.itemId, args.sourceMealId),
        eq(itemGrants.granteeUserId, args.forkerUserId),
        isNull(itemGrants.revokedAt)
      )
    )
    .limit(1);
  if (!grant) throw new Error("This recipe isn't shared with you.");
  if (grant.savedCopyItemId) return { newMealId: grant.savedCopyItemId }; // dedup

  const [source] = await db
    .select({
      name: meals.name,
      photoUrl: meals.photoUrl,
      notes: meals.notes,
      recipeText: meals.recipeText,
      recipeSourceUrl: meals.recipeSourceUrl,
      ingredients: meals.ingredients,
      archivedAt: meals.archivedAt
    })
    .from(meals)
    .where(eq(meals.id, args.sourceMealId))
    .limit(1);
  if (!source || source.archivedAt) throw new Error("Recipe not found.");

  const household = await getCurrentHousehold(args.forkerUserId);

  // Pick a name that doesn't collide with the forker's existing recipes
  // (unique index is per household + normalized name).
  const taken = new Set(
    (
      await db
        .select({ normalizedName: meals.normalizedName })
        .from(meals)
        .where(and(eq(meals.householdId, household.id), isNull(meals.archivedAt)))
    ).map((r) => r.normalizedName)
  );
  let name = source.name;
  if (taken.has(normalizeMealName(name))) {
    name = `${source.name} (saved)`;
    let n = 2;
    while (taken.has(normalizeMealName(name))) {
      name = `${source.name} (saved ${n})`;
      n += 1;
    }
  }

  const [sourceIngredients, sourceSteps] = await Promise.all([
    db
      .select({
        id: mealIngredients.id,
        position: mealIngredients.position,
        name: mealIngredients.name,
        quantityString: mealIngredients.quantityString,
        prepNote: mealIngredients.prepNote
      })
      .from(mealIngredients)
      .where(eq(mealIngredients.mealId, args.sourceMealId))
      .orderBy(asc(mealIngredients.position)),
    db
      .select({
        position: recipeSteps.position,
        title: recipeSteps.title,
        time: recipeSteps.time,
        body: recipeSteps.body,
        ingredientIds: recipeSteps.ingredientIds
      })
      .from(recipeSteps)
      .where(eq(recipeSteps.mealId, args.sourceMealId))
      .orderBy(asc(recipeSteps.position))
  ]);

  const newMealId = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(meals)
      .values({
        householdId: household.id,
        createdByUserId: args.forkerUserId,
        name,
        normalizedName: normalizeMealName(name),
        photoUrl: source.photoUrl,
        notes: source.notes,
        recipeText: source.recipeText,
        recipeSourceUrl: source.recipeSourceUrl,
        ingredients: source.ingredients
      })
      .returning({ id: meals.id });
    const mealId = created!.id;

    // Copy structured ingredients, remembering old→new ids to remap steps.
    const idMap = new Map<string, string>();
    for (const ing of sourceIngredients) {
      const [row] = await tx
        .insert(mealIngredients)
        .values({
          mealId,
          position: ing.position,
          name: ing.name,
          quantityString: ing.quantityString,
          prepNote: ing.prepNote
        })
        .returning({ id: mealIngredients.id });
      idMap.set(ing.id, row!.id);
    }

    if (sourceSteps.length > 0) {
      await tx.insert(recipeSteps).values(
        sourceSteps.map((step) => ({
          mealId,
          position: step.position,
          title: step.title,
          time: step.time,
          body: step.body,
          ingredientIds: step.ingredientIds
            .map((oldId) => idMap.get(oldId))
            .filter((v): v is string => Boolean(v))
        }))
      );
    }

    await tx
      .update(itemGrants)
      .set({ savedCopyItemId: mealId })
      .where(eq(itemGrants.id, grant.id));

    return mealId;
  });

  return { newMealId };
}

export type ActiveShareLink = {
  shareId: string;
  mealId: string;
  mealName: string;
  url: string;
};

/**
 * All of the user's active "anyone with the link" recipe shares — for the
 * Settings → Sharing & privacy "Active share links" list. Reuses the
 * `recipe_shares` table (recipe link shares); revoke via the shares router.
 */
export async function listActiveShareLinks(userId: string): Promise<ActiveShareLink[]> {
  const base = getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const rows = await db
    .select({
      shareId: recipeShares.id,
      mealId: recipeShares.mealId,
      mealName: meals.name,
      token: recipeShares.token
    })
    .from(recipeShares)
    .innerJoin(meals, eq(meals.id, recipeShares.mealId))
    .where(
      and(
        eq(recipeShares.createdByUserId, userId),
        isNull(recipeShares.revokedAt),
        isNull(meals.archivedAt)
      )
    )
    .orderBy(desc(recipeShares.createdAt));
  return rows.map((r) => ({
    shareId: r.shareId,
    mealId: r.mealId,
    mealName: r.mealName,
    url: `${base}/share/${r.token}`
  }));
}

/**
 * Notify every active grantee that the owner edited a shared item ("your
 * live copy is current"). Fire-and-forget from owner-edit paths. Deduped
 * per grantee per item within a 6h window so a flurry of edits doesn't
 * spam the bell. No-op when the item has no grantees.
 */
export async function notifyGranteesOfUpdate(args: {
  itemType: ItemType;
  itemId: string;
}): Promise<void> {
  const item = await resolveItem(args.itemType, args.itemId);
  if (!item) return;

  const grantees = await db
    .select({ granteeUserId: itemGrants.granteeUserId })
    .from(itemGrants)
    .where(
      and(
        eq(itemGrants.itemType, args.itemType),
        eq(itemGrants.itemId, args.itemId),
        isNull(itemGrants.revokedAt)
      )
    );
  if (grantees.length === 0) return;

  const ownerName = await displayName(item.ownerUserId);
  await Promise.all(
    grantees.map((g) =>
      createNotificationIfNotRecent(
        {
          userId: g.granteeUserId,
          type: "system",
          title: `${ownerName} updated "${item.name}" — your live copy is current.`,
          href: "/library?surface=shared",
          payload: {
            kind: "update",
            itemType: args.itemType,
            itemId: args.itemId,
            actorUserId: item.ownerUserId
          }
        },
        6
      ).catch(() => null)
    )
  );
}

/** Small helper: a user's display name (falls back to email local part). */
async function displayName(userId: string): Promise<string> {
  const [row] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!row) return "Someone";
  return row.name?.trim() || row.email.split("@")[0] || "Someone";
}
