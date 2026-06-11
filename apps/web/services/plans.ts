import "server-only";

import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { requireHouseholdMember } from "@/lib/auth/session";
import { requireFeatureAccess } from "@/lib/gates/resolver";
import { logger } from "@/lib/observability/logger";
import { mealVisibilityFilter, planVisibilityFilter } from "@/lib/meals/visibility";
import {
  dishImages,
  mealIngredients,
  mealLogs,
  meals,
  planDishes,
  plans,
  users,
  type Verdict
} from "@/db/schema";
import {
  accessibleRecipeIds,
  canEditItem,
  canManageSharing,
  getGrantRole,
  notifyGranteesOfUpdate,
  requireItemEditor,
  resolveRole,
  type ItemRole
} from "@/services/sharing";

/**
 * Round 5 — Plans service. All household-scoped: every public fn calls
 * `requireHouseholdMember` after resolving the target plan's household.
 *
 * Plans are member-equal (any member can create / edit / annotate);
 * authorization is "user is a member of this plan's household." No
 * granular permissions for v1.
 *
 * Services throw; actions catch and return discriminated unions.
 */

export type PlanRow = typeof plans.$inferSelect;

export type PlanDishWithMeal = {
  id: string;
  planId: string;
  mealId: string;
  addedByUserId: string | null;
  sortOrder: number;
  actualEffort: "quick" | "easy" | "medium" | "high_effort" | null;
  timeTakenMinutes: number | null;
  verdict: Verdict | null;
  annotationNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  mealName: string;
  mealPhotoUrl: string | null;
  addedByName: string | null;
  /**
   * Per-item sharing: true when the viewer is a co-cook who lacks the
   * dish's recipe (the recipe wasn't shared with them). The Plan Detail UI
   * renders these as locked rows with a "Request recipe" action instead of
   * hiding them. False for the owner and for dishes they can access.
   */
  locked: boolean;
};

export type PlanWithDishes = PlanRow & {
  dishes: PlanDishWithMeal[];
  /** The plan owner's display name (for the grantee "Shared by X" strip). */
  ownerName: string | null;
  /** Viewer's effective permissions on this plan (server-authoritative). */
  viewerIsOwner: boolean;
  viewerCanEdit: boolean;
  viewerCanManageSharing: boolean;
  /**
   * Round 32 — count of dishes filtered out because the underlying
   * meal is another member's personal recipe. The Plan Detail UI
   * renders a "N dishes hidden by other members" placeholder when
   * this is greater than zero so non-creators don't see a
   * mysteriously-shorter dish list.
   */
  hiddenDishCount: number;
};

async function loadPlanOrThrow(planId: string): Promise<PlanRow> {
  const [row] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
  if (!row) {
    throw new Error("Plan not found.");
  }
  return row;
}

export type CreatePlanArgs = {
  householdId: string;
  userId: string;
  name: string;
  scheduledDate: string;
  notes?: string;
};

export async function createPlan(args: CreatePlanArgs): Promise<PlanRow> {
  await requireHouseholdMember(args.userId, args.householdId);
  await requireFeatureAccess(args.userId, "plans_create");

  // Empty / whitespace-only notes resolve to null so we don't store a
  // surface that renders as a vacant box in the UI.
  const notes = args.notes?.trim();
  const [created] = await db
    .insert(plans)
    .values({
      householdId: args.householdId,
      createdByUserId: args.userId,
      name: args.name,
      scheduledDate: args.scheduledDate,
      notes: notes && notes.length > 0 ? notes : null,
      updatedAt: new Date()
    })
    .returning();
  if (!created) {
    throw new Error("Couldn't create plan.");
  }
  logger.info("plan_created", {
    userId: args.userId,
    householdId: args.householdId,
    planId: created.id
  });
  return created;
}

/**
 * Combined shopping list for a plan — the deduped ingredient names across the
 * given dish meals. Prefers each meal's structured `meal_ingredients`; falls
 * back to the legacy `meals.ingredients` text[] for meals that have no
 * structured rows yet. Read-only aggregation; no schema. Caller passes only
 * the meal ids the viewer can access (locked dishes are excluded).
 */
export async function getPlanShoppingList(mealIds: string[]): Promise<string[]> {
  if (mealIds.length === 0) return [];

  const structured = await db
    .select({ mealId: mealIngredients.mealId, name: mealIngredients.name })
    .from(mealIngredients)
    .where(
      and(
        inArray(mealIngredients.mealId, mealIds),
        isNull(mealIngredients.variantId)
      )
    )
    .orderBy(asc(mealIngredients.position));

  const withStructured = new Set(structured.map((r) => r.mealId));
  const legacyIds = mealIds.filter((id) => !withStructured.has(id));
  const legacy = legacyIds.length
    ? await db
        .select({ ingredients: meals.ingredients })
        .from(meals)
        .where(inArray(meals.id, legacyIds))
    : [];

  const seen = new Set<string>();
  const out: string[] = [];
  const add = (raw: string | null | undefined) => {
    const name = raw?.trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(name);
  };
  for (const r of structured) add(r.name);
  for (const r of legacy) for (const ing of r.ingredients ?? []) add(ing);
  return out;
}

export async function getPlan(args: { planId: string; userId: string }): Promise<PlanWithDishes> {
  const plan = await loadPlanOrThrow(args.planId);

  // Per-item sharing authz: only the owner or a co-cook holding an active
  // grant for this plan may view it. Household co-membership no longer
  // grants access (dropped alongside the recipe/plan visibility flip), so
  // a member of the creator's household can't see a plan they weren't
  // explicitly granted.
  const isOwner = plan.createdByUserId === args.userId;
  const grantRole = isOwner ? null : await getGrantRole(args.userId, "plan", args.planId);
  if (!isOwner && grantRole === null) {
    throw new Error("Not authorized for this plan.");
  }
  const viewerRole: ItemRole = isOwner ? "owner" : grantRole!;

  // LEFT JOIN users via addedByUserId so a deleted member doesn't drop
  // the dish from the plan (matches the Round 4.7 attribution contract).
  //
  // R32 — visibility for dishes: we fetch ALL dishes on the plan first,
  // then partition into visible vs hidden so the response can carry a
  // separate `hiddenDishCount`. Doing it in two phases (rather than
  // pushing the predicate into the WHERE clause) lets us return the
  // count alongside the list — the UI needs both. A single query with
  // the filter would silently drop hidden dishes and leave the
  // non-creator wondering why the plan looks short.
  const rows = await db
    .select({
      id: planDishes.id,
      planId: planDishes.planId,
      mealId: planDishes.mealId,
      addedByUserId: planDishes.addedByUserId,
      sortOrder: planDishes.sortOrder,
      actualEffort: planDishes.actualEffort,
      timeTakenMinutes: planDishes.timeTakenMinutes,
      verdict: planDishes.verdict,
      annotationNotes: planDishes.annotationNotes,
      createdAt: planDishes.createdAt,
      updatedAt: planDishes.updatedAt,
      mealName: meals.name,
      // Own photo wins; the app-wide AI dish image is the fallback (same
      // coalesce the dashboard, library, and recipe reads use). Failed
      // dish-image rows carry a null image_url, so coalesce skips them.
      mealPhotoUrl: sql<string | null>`coalesce(${meals.photoUrl}, ${dishImages.imageUrl})`,
      mealCreatorUserId: meals.createdByUserId,
      mealHouseholdId: meals.householdId,
      addedByName: users.name
    })
    .from(planDishes)
    .innerJoin(meals, eq(meals.id, planDishes.mealId))
    .leftJoin(dishImages, eq(dishImages.normalizedName, meals.normalizedName))
    .leftJoin(users, eq(users.id, planDishes.addedByUserId))
    .where(eq(planDishes.planId, args.planId))
    .orderBy(asc(planDishes.sortOrder), asc(planDishes.createdAt));

  // Per-item sharing: instead of hiding inaccessible dishes, mark them
  // `locked`. A dish is accessible if the viewer owns the recipe or holds
  // an active grant for it. The legacy "shared recipe in my household"
  // branch was removed alongside the recipe visibility flip — household
  // co-membership no longer grants recipe access. Co-cooks see locked rows
  // they can "Request".
  const grantedRecipeIds = await accessibleRecipeIds(
    args.userId,
    rows.map((r) => r.mealId)
  );
  const dishes: PlanDishWithMeal[] = rows.map((r) => {
    const accessible =
      r.mealCreatorUserId === args.userId || grantedRecipeIds.has(r.mealId);
    return {
      id: r.id,
      planId: r.planId,
      mealId: r.mealId,
      addedByUserId: r.addedByUserId,
      sortOrder: r.sortOrder,
      actualEffort: r.actualEffort,
      timeTakenMinutes: r.timeTakenMinutes,
      verdict: r.verdict,
      annotationNotes: r.annotationNotes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      mealName: r.mealName,
      mealPhotoUrl: r.mealPhotoUrl,
      addedByName: r.addedByName,
      locked: !accessible
    };
  });

  const [owner] = plan.createdByUserId
    ? await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, plan.createdByUserId))
        .limit(1)
    : [];

  // `hiddenDishCount` retained for the response shape; locked dishes are
  // now surfaced inline rather than hidden, so it's always 0.
  return {
    ...plan,
    dishes,
    ownerName: owner?.name ?? null,
    hiddenDishCount: 0,
    viewerIsOwner: isOwner,
    viewerCanEdit: canEditItem(viewerRole),
    viewerCanManageSharing: canManageSharing(viewerRole)
  };
}

export type ListPlansArgs = {
  householdId: string;
  userId: string;
  includeArchived?: boolean;
};

export type PlanListRow = PlanRow & { dishCount: number };

export async function listPlansForHousehold(args: ListPlansArgs): Promise<PlanListRow[]> {
  await requireHouseholdMember(args.userId, args.householdId);

  // Per-item: the list shows plans you own or were granted, scoped to the
  // current household. The visibility filter (own-or-granted) replaces the
  // old household-wide listing that leaked co-members' plans to each other.
  const visible = planVisibilityFilter(args.userId, args.householdId);
  const where = args.includeArchived
    ? and(eq(plans.householdId, args.householdId), visible)
    : and(
        eq(plans.householdId, args.householdId),
        isNull(plans.archivedAt),
        visible
      );

  return db
    .select({
      id: plans.id,
      householdId: plans.householdId,
      createdByUserId: plans.createdByUserId,
      name: plans.name,
      scheduledDate: plans.scheduledDate,
      notes: plans.notes,
      archivedAt: plans.archivedAt,
      createdAt: plans.createdAt,
      updatedAt: plans.updatedAt,
      dishCount: sql<number>`count(${planDishes.id})::int`
    })
    .from(plans)
    .leftJoin(planDishes, eq(planDishes.planId, plans.id))
    .where(where)
    .groupBy(plans.id)
    .orderBy(desc(plans.scheduledDate), desc(plans.createdAt));
}

export type UpdatePlanArgs = {
  planId: string;
  userId: string;
  patch: {
    name?: string;
    scheduledDate?: string;
    notes?: string;
  };
};

export async function updatePlan(args: UpdatePlanArgs): Promise<PlanRow> {
  const plan = await loadPlanOrThrow(args.planId);
  await requireItemEditor(args.userId, "plan", plan.id, plan.createdByUserId);

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (args.patch.name !== undefined) set.name = args.patch.name;
  if (args.patch.scheduledDate !== undefined) set.scheduledDate = args.patch.scheduledDate;
  if (args.patch.notes !== undefined) set.notes = args.patch.notes;

  const [updated] = await db
    .update(plans)
    .set(set)
    .where(eq(plans.id, args.planId))
    .returning();
  if (!updated) throw new Error("Plan not found.");
  void notifyGranteesOfUpdate({ itemType: "plan", itemId: args.planId }).catch(() => {});
  return updated;
}

export async function archivePlan(args: { planId: string; userId: string }): Promise<void> {
  const plan = await loadPlanOrThrow(args.planId);
  // Archiving is delete-adjacent — owner only (editors/admins can't delete).
  if (plan.createdByUserId !== args.userId) {
    throw new Error("Only the owner can archive this plan.");
  }

  await db
    .update(plans)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(plans.id, args.planId));
  logger.info("plan_archived", { userId: args.userId, planId: args.planId });
}

export async function unarchivePlan(args: { planId: string; userId: string }): Promise<void> {
  const plan = await loadPlanOrThrow(args.planId);
  if (plan.createdByUserId !== args.userId) {
    throw new Error("Only the owner can restore this plan.");
  }

  await db
    .update(plans)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(plans.id, args.planId));
}

/**
 * Append a dish to a plan. Idempotent via the unique `(planId, mealId)`
 * index — if the meal is already on the plan, this silently no-ops.
 * Returns the existing or newly-created planDish row.
 *
 * Cross-household protection: the meal must belong to the plan's household.
 * Without this check, a member could add a meal from one household to a
 * plan in another (if they're a member of both). We reject those at the
 * service layer rather than relying on action callers to know.
 */
export async function addDishToPlan(args: {
  planId: string;
  userId: string;
  mealId: string;
}): Promise<typeof planDishes.$inferSelect> {
  const plan = await loadPlanOrThrow(args.planId);
  await requireItemEditor(args.userId, "plan", plan.id, plan.createdByUserId);

  const [meal] = await db
    .select({
      id: meals.id,
      householdId: meals.householdId,
      archivedAt: meals.archivedAt,
      // Visibility field so we can reject the add if the meal isn't
      // visible to the caller. Treating it as "not found" matches the
      // rest of the read path: never leak the existence of a recipe the
      // caller has no access to through error messages.
      createdByUserId: meals.createdByUserId
    })
    .from(meals)
    .where(eq(meals.id, args.mealId))
    .limit(1);
  if (!meal) throw new Error("Meal not found.");
  if (meal.householdId !== plan.householdId) {
    logger.error("plan_dish_cross_household_attempt", {
      userId: args.userId,
      planId: args.planId,
      mealId: args.mealId,
      planHouseholdId: plan.householdId,
      mealHouseholdId: meal.householdId
    });
    throw new Error("Meal not in this household.");
  }
  if (meal.archivedAt) throw new Error("Meal is archived.");
  // Reject adding a meal the caller can't view. Per-item: they can add it
  // only if they own it or hold an active grant. Identical surfacing to a
  // cross-household add ("not found") so the meal's existence doesn't leak.
  const isVisible =
    meal.createdByUserId === args.userId ||
    (await accessibleRecipeIds(args.userId, [args.mealId])).has(args.mealId);
  if (!isVisible) {
    logger.warn("plan_dish_hidden_meal_attempt", {
      userId: args.userId,
      planId: args.planId,
      mealId: args.mealId
    });
    throw new Error("Meal not found.");
  }

  // Append at the end of sortOrder. One round-trip for the max, one for
  // the insert. Could be done in a single statement via a subquery, but
  // the readability win of the two-step is worth the extra ms.
  const [maxRow] = await db
    .select({ value: sql<number>`coalesce(max(${planDishes.sortOrder}), -1)::int` })
    .from(planDishes)
    .where(eq(planDishes.planId, args.planId));
  const nextSortOrder = Number(maxRow?.value ?? -1) + 1;

  // ON CONFLICT DO NOTHING + RETURNING handles the idempotent case. If a
  // row already exists for (planId, mealId), the insert is a no-op and
  // returning yields no rows — we then look it up to return the existing
  // row.
  const [inserted] = await db
    .insert(planDishes)
    .values({
      planId: args.planId,
      mealId: args.mealId,
      addedByUserId: args.userId,
      sortOrder: nextSortOrder,
      updatedAt: new Date()
    })
    .onConflictDoNothing({
      target: [planDishes.planId, planDishes.mealId]
    })
    .returning();

  if (inserted) {
    void notifyGranteesOfUpdate({ itemType: "plan", itemId: args.planId }).catch(() => {});
    return inserted;
  }

  // Conflict path — the dish was already on the plan. Return the existing
  // row so the caller can update its UI consistently.
  const [existing] = await db
    .select()
    .from(planDishes)
    .where(
      and(eq(planDishes.planId, args.planId), eq(planDishes.mealId, args.mealId))
    )
    .limit(1);
  if (!existing) throw new Error("Couldn't add dish to plan.");
  return existing;
}

export async function removeDishFromPlan(args: {
  planId: string;
  userId: string;
  planDishId: string;
}): Promise<void> {
  const plan = await loadPlanOrThrow(args.planId);
  await requireItemEditor(args.userId, "plan", plan.id, plan.createdByUserId);

  const [deleted] = await db
    .delete(planDishes)
    .where(
      and(eq(planDishes.id, args.planDishId), eq(planDishes.planId, args.planId))
    )
    .returning({ id: planDishes.id });
  if (!deleted) throw new Error("Plan dish not found.");
  void notifyGranteesOfUpdate({ itemType: "plan", itemId: args.planId }).catch(() => {});
}

/**
 * Bulk reorder. Caller passes the dish ids in the order they should appear;
 * each row gets `sortOrder = index`. Done in a transaction so partial
 * failure leaves no half-reordered state.
 *
 * Defensive: filter the update WHERE to dishes that belong to the plan,
 * so a malicious caller can't sneak in ids from another plan.
 */
export async function reorderDishes(args: {
  planId: string;
  userId: string;
  dishIdsInOrder: string[];
}): Promise<void> {
  const plan = await loadPlanOrThrow(args.planId);
  await requireItemEditor(args.userId, "plan", plan.id, plan.createdByUserId);

  await db.transaction(async (tx) => {
    for (let i = 0; i < args.dishIdsInOrder.length; i++) {
      const dishId = args.dishIdsInOrder[i]!;
      await tx
        .update(planDishes)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(and(eq(planDishes.id, dishId), eq(planDishes.planId, args.planId)));
    }
  });
  void notifyGranteesOfUpdate({ itemType: "plan", itemId: args.planId }).catch(() => {});
}

export type UpdateDishAnnotationArgs = {
  planDishId: string;
  userId: string;
  patch: {
    actualEffort?: "quick" | "easy" | "medium" | "high_effort" | null;
    timeTakenMinutes?: number | null;
    verdict?: Verdict | null;
    annotationNotes?: string | null;
  };
};

/**
 * Partial annotation update. `null` explicitly clears a field; `undefined`
 * leaves it alone. Validators ensure at least one field is provided so we
 * don't issue empty UPDATEs.
 */
export async function updateDishAnnotation(
  args: UpdateDishAnnotationArgs
): Promise<typeof planDishes.$inferSelect> {
  // First resolve the dish → plan → household so the membership check
  // gates the right scope.
  const [dish] = await db
    .select({ id: planDishes.id, planId: planDishes.planId })
    .from(planDishes)
    .where(eq(planDishes.id, args.planDishId))
    .limit(1);
  if (!dish) throw new Error("Plan dish not found.");
  const plan = await loadPlanOrThrow(dish.planId);
  await requireItemEditor(args.userId, "plan", plan.id, plan.createdByUserId);

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (args.patch.actualEffort !== undefined) set.actualEffort = args.patch.actualEffort;
  if (args.patch.timeTakenMinutes !== undefined) set.timeTakenMinutes = args.patch.timeTakenMinutes;
  if (args.patch.verdict !== undefined) set.verdict = args.patch.verdict;
  if (args.patch.annotationNotes !== undefined) set.annotationNotes = args.patch.annotationNotes;

  const [updated] = await db
    .update(planDishes)
    .set(set)
    .where(eq(planDishes.id, args.planDishId))
    .returning();
  if (!updated) throw new Error("Plan dish not found.");
  return updated;
}

export type ClonePlanResult = {
  newPlanId: string;
  newPlanName: string;
  newScheduledDate: string;
  previousAnnotations: Record<
    string,
    {
      verdict: Verdict | null;
      actualEffort: "quick" | "easy" | "medium" | "high_effort" | null;
      annotationNotes: string | null;
      timeTakenMinutes: number | null;
    }
  >;
};

/**
 * Clone a past plan into a new draft. The killer flow:
 *   - Same household, new name + date
 *   - Same dishes (mealId, sortOrder preserved)
 *   - Annotation fields NOT copied — they're past wisdom, not new state.
 *     The previous annotations come back in `previousAnnotations` keyed by
 *     mealId so the UI can render advisory hints ("Last time: don't repeat")
 *     without persisting them on the new plan.
 *
 * All inside one transaction so a half-cloned plan never exists.
 */
export async function clonePlanFromPast(args: {
  sourcePlanId: string;
  userId: string;
  newName: string;
  newScheduledDate: string;
}): Promise<ClonePlanResult> {
  const source = await loadPlanOrThrow(args.sourcePlanId);
  // Cloning makes a NEW plan you own; you just need to be able to VIEW the
  // source (own it or hold any grant).
  if ((await resolveRole(args.userId, "plan", source.id, source.createdByUserId)) === null) {
    throw new Error("Not authorized for this plan.");
  }
  await requireFeatureAccess(args.userId, "plans_clone");

  return db.transaction(async (tx) => {
    const sourceDishes = await tx
      .select({
        mealId: planDishes.mealId,
        sortOrder: planDishes.sortOrder,
        actualEffort: planDishes.actualEffort,
        timeTakenMinutes: planDishes.timeTakenMinutes,
        verdict: planDishes.verdict,
        annotationNotes: planDishes.annotationNotes
      })
      .from(planDishes)
      .where(eq(planDishes.planId, args.sourcePlanId))
      .orderBy(asc(planDishes.sortOrder));

    const [created] = await tx
      .insert(plans)
      .values({
        householdId: source.householdId,
        createdByUserId: args.userId,
        name: args.newName,
        scheduledDate: args.newScheduledDate,
        notes: null,
        updatedAt: new Date()
      })
      .returning({
        id: plans.id,
        name: plans.name,
        scheduledDate: plans.scheduledDate
      });
    if (!created) throw new Error("Couldn't clone plan.");

    if (sourceDishes.length > 0) {
      await tx.insert(planDishes).values(
        sourceDishes.map((d, i) => ({
          planId: created.id,
          mealId: d.mealId,
          addedByUserId: args.userId,
          // Re-sequence sortOrder from 0 so any gaps in the source are
          // collapsed in the clone.
          sortOrder: i,
          // Annotation fields deliberately omitted — they default to NULL.
          updatedAt: new Date()
        }))
      );
    }

    // Build the previousAnnotations map keyed by mealId for UI hints.
    const previousAnnotations: ClonePlanResult["previousAnnotations"] = {};
    for (const d of sourceDishes) {
      // Only include entries where at least one annotation was actually
      // captured — otherwise the UI would render badges for dishes that
      // had no prior wisdom at all.
      if (
        d.verdict !== null ||
        d.actualEffort !== null ||
        d.annotationNotes !== null ||
        d.timeTakenMinutes !== null
      ) {
        previousAnnotations[d.mealId] = {
          verdict: d.verdict,
          actualEffort: d.actualEffort,
          annotationNotes: d.annotationNotes,
          timeTakenMinutes: d.timeTakenMinutes
        };
      }
    }

    logger.info("plan_cloned", {
      userId: args.userId,
      sourcePlanId: args.sourcePlanId,
      newPlanId: created.id,
      dishesCopied: sourceDishes.length,
      annotationsCarried: Object.keys(previousAnnotations).length
    });

    return {
      newPlanId: created.id,
      newPlanName: created.name,
      newScheduledDate: created.scheduledDate,
      previousAnnotations
    };
  });
}

/**
 * Aggregate effort breakdown for the plan-detail header chip ("4 quick · 3
 * easy · 1 high_effort · 2 unrated"). Uses `actualEffort` where set
 * (post-event wisdom); for dishes without an annotation yet, falls back
 * to the most recent meal_log's effort in this household (planning-time
 * estimate based on the household's last attempt). Dishes with no logs
 * yet AND no annotation count as `unrated` — the chip surfaces that as
 * "we don't know yet" rather than guessing.
 */
export type PlanEffortAggregate = {
  quick: number;
  easy: number;
  medium: number;
  high_effort: number;
  unrated: number;
};

export async function getPlanEffortAggregate(args: {
  planId: string;
  userId: string;
}): Promise<PlanEffortAggregate> {
  const plan = await loadPlanOrThrow(args.planId);
  // Read sub-view of a plan you're viewing — any access (own/grant) suffices.
  if ((await resolveRole(args.userId, "plan", plan.id, plan.createdByUserId)) === null) {
    throw new Error("Not authorized for this plan.");
  }

  // Pull every dish on the plan + its current annotation effort, in
  // one query. The most-recent-log lookup is a correlated subquery so
  // we get a single row per dish.
  //
  // R32 — join meals + filter by visibility so hidden dishes (other
  // members' personal meals) drop out of the aggregate. Without this,
  // a non-creator viewing a shared plan would see the aggregate
  // include dishes they can't see — the header chip would over-count.
  const rows = await db
    .select({
      actualEffort: planDishes.actualEffort,
      mealId: planDishes.mealId,
      fallbackEffort: sql<string | null>`(
        SELECT ${mealLogs.effortLevel}
        FROM ${mealLogs}
        WHERE ${mealLogs.mealId} = ${planDishes.mealId}
          AND ${mealLogs.householdId} = ${plan.householdId}
          AND ${mealLogs.deletedAt} IS NULL
        ORDER BY ${mealLogs.cookedAt} DESC
        LIMIT 1
      )`
    })
    .from(planDishes)
    .innerJoin(meals, eq(meals.id, planDishes.mealId))
    .where(
      and(
        eq(planDishes.planId, args.planId),
        mealVisibilityFilter(args.userId, plan.householdId)
      )
    );

  const out: PlanEffortAggregate = {
    quick: 0,
    easy: 0,
    medium: 0,
    high_effort: 0,
    unrated: 0
  };
  for (const r of rows) {
    const effort = r.actualEffort ?? r.fallbackEffort;
    if (effort === "quick" || effort === "easy" || effort === "medium" || effort === "high_effort") {
      out[effort] += 1;
    } else {
      out.unrated += 1;
    }
  }
  return out;
}

/**
 * Look up the annotation hints map from a past plan, keyed by mealId.
 * Used by:
 *   - clonePlanFromPast (returned in its result so the UI can show hints
 *     immediately after navigation)
 *   - the new-plan detail page when `?hintsFrom=<sourcePlanId>` is in
 *     the URL — so hints survive refresh / direct link
 *
 * Only entries with at least one non-null annotation field are included,
 * so the UI never renders empty hint badges.
 */
export type PreviousAnnotationsMap = Record<
  string,
  {
    verdict: Verdict | null;
    actualEffort: "quick" | "easy" | "medium" | "high_effort" | null;
    annotationNotes: string | null;
    timeTakenMinutes: number | null;
  }
>;

export async function getPlanAnnotationsByMealId(args: {
  planId: string;
  userId: string;
}): Promise<PreviousAnnotationsMap> {
  const plan = await loadPlanOrThrow(args.planId);
  if ((await resolveRole(args.userId, "plan", plan.id, plan.createdByUserId)) === null) {
    throw new Error("Not authorized for this plan.");
  }

  const rows = await db
    .select({
      mealId: planDishes.mealId,
      actualEffort: planDishes.actualEffort,
      timeTakenMinutes: planDishes.timeTakenMinutes,
      verdict: planDishes.verdict,
      annotationNotes: planDishes.annotationNotes
    })
    .from(planDishes)
    .where(eq(planDishes.planId, args.planId));

  const out: PreviousAnnotationsMap = {};
  for (const r of rows) {
    if (
      r.verdict !== null ||
      r.actualEffort !== null ||
      r.annotationNotes !== null ||
      r.timeTakenMinutes !== null
    ) {
      out[r.mealId] = {
        verdict: r.verdict,
        actualEffort: r.actualEffort,
        annotationNotes: r.annotationNotes,
        timeTakenMinutes: r.timeTakenMinutes
      };
    }
  }
  return out;
}

/**
 * Lightweight meal-library listing for the "Add dish" picker in the
 * plan-detail UI. Returns active (non-archived) meals in the household,
 * with the columns the picker renders. Optionally filtered by a
 * substring search over name. No pagination yet — at v1 scale, every
 * household has hundreds of meals at most; the picker can render them
 * all and rely on the client filter for further narrowing.
 */
export type MealLibraryRow = {
  id: string;
  name: string;
  photoUrl: string | null;
  createdByUserId: string | null;
  /** Creation order — backs the "Newest added" sort. */
  addedAt: Date;
  /** When archived — null for active rows; set for the Archived view. */
  archivedAt: Date | null;
  /** R36 — AI tags, for faceted filtering. */
  cuisine: string | null;
  course: string | null;
  mainIngredient: string | null;
  diet: string[];
  occasion: string[];
};

export async function listMealLibrary(args: {
  userId: string;
  householdId: string;
  q?: string;
  limit?: number;
  /**
   * R36 — `active` (default) is the library grid: not archived, not deleted.
   * `archived` is the Archived view: archived AND not deleted, newest-archived
   * first. Deleted rows never appear in either.
   */
  scope?: "active" | "archived";
}): Promise<MealLibraryRow[]> {
  await requireHouseholdMember(args.userId, args.householdId);

  const limit = Math.max(1, Math.min(500, args.limit ?? 200));
  const q = args.q?.trim().toLowerCase() ?? "";
  const scope = args.scope ?? "active";

  const rows = await db
    .select({
      id: meals.id,
      name: meals.name,
      // Own photo wins; the app-wide AI dish image is the fallback (same
      // coalesce the dashboard + recipe reads use). Failed dish-image rows
      // carry a null image_url, so coalesce skips them automatically.
      photoUrl: sql<string | null>`coalesce(${meals.photoUrl}, ${dishImages.imageUrl})`,
      createdByUserId: meals.createdByUserId,
      addedAt: meals.createdAt,
      archivedAt: meals.archivedAt,
      cuisine: meals.cuisine,
      course: meals.course,
      mainIngredient: meals.mainIngredient,
      diet: meals.diet,
      occasion: meals.occasion
    })
    .from(meals)
    .leftJoin(dishImages, eq(dishImages.normalizedName, meals.normalizedName))
    .where(
      and(
        eq(meals.householdId, args.householdId),
        // R36 — deleted rows are excluded from both scopes.
        isNull(meals.deletedAt),
        scope === "archived" ? isNotNull(meals.archivedAt) : isNull(meals.archivedAt),
        // R32 — strip other members' personal meals from the Library
        // listing + the add-dish picker. The client UI is responsible
        // for then partitioning the remaining (creator-own + shared)
        // rows into Personal vs Shared chips for the viewer.
        mealVisibilityFilter(args.userId, args.householdId),
        q.length > 0 ? sql`lower(${meals.name}) like ${`%${q}%`}` : undefined
      )
    )
    .orderBy(scope === "archived" ? desc(meals.archivedAt) : asc(meals.name))
    .limit(limit);

  // Array columns come back `string[] | null`; normalize to [] for the client.
  return rows.map((r) => ({ ...r, diet: r.diet ?? [], occasion: r.occasion ?? [] }));
}

// Helper used by clone-UX to detect cross-household ids that ended up in
// the inArray-driven `previousAnnotations` map. Returns the set of meal
// ids that actually exist in the requested household. Used as a defense
// when the clone-action surface accepts mealIds from the source — we
// don't want hint badges referencing meals the new plan can't actually
// hold.
export async function filterMealIdsInHousehold(args: {
  userId: string;
  householdId: string;
  mealIds: string[];
}): Promise<string[]> {
  await requireHouseholdMember(args.userId, args.householdId);
  if (args.mealIds.length === 0) return [];

  // R32 — visibility filter applies here because the caller (clone-UX)
  // uses the returned ids to render hint badges. Other members'
  // personal meals would otherwise leak through as visible badge
  // labels in the new plan.
  const rows = await db
    .select({ id: meals.id })
    .from(meals)
    .where(
      and(
        eq(meals.householdId, args.householdId),
        inArray(meals.id, args.mealIds),
        mealVisibilityFilter(args.userId, args.householdId)
      )
    );
  return rows.map((r) => r.id);
}
