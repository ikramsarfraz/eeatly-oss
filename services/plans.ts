import "server-only";

import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { requireHouseholdMember } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";
import { mealLogs, meals, planDishes, plans, users, type Verdict } from "@/db/schema";

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
};

export type PlanWithDishes = PlanRow & {
  dishes: PlanDishWithMeal[];
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

export async function getPlan(args: { planId: string; userId: string }): Promise<PlanWithDishes> {
  const plan = await loadPlanOrThrow(args.planId);
  await requireHouseholdMember(args.userId, plan.householdId);

  // LEFT JOIN users via addedByUserId so a deleted member doesn't drop
  // the dish from the plan (matches the Round 4.7 attribution contract).
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
      mealPhotoUrl: meals.photoUrl,
      addedByName: users.name
    })
    .from(planDishes)
    .innerJoin(meals, eq(meals.id, planDishes.mealId))
    .leftJoin(users, eq(users.id, planDishes.addedByUserId))
    .where(eq(planDishes.planId, args.planId))
    .orderBy(asc(planDishes.sortOrder), asc(planDishes.createdAt));

  return { ...plan, dishes: rows };
}

export type ListPlansArgs = {
  householdId: string;
  userId: string;
  includeArchived?: boolean;
};

export type PlanListRow = PlanRow & { dishCount: number };

export async function listPlansForHousehold(args: ListPlansArgs): Promise<PlanListRow[]> {
  await requireHouseholdMember(args.userId, args.householdId);

  const where = args.includeArchived
    ? eq(plans.householdId, args.householdId)
    : and(eq(plans.householdId, args.householdId), isNull(plans.archivedAt));

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
  await requireHouseholdMember(args.userId, plan.householdId);

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
  return updated;
}

export async function archivePlan(args: { planId: string; userId: string }): Promise<void> {
  const plan = await loadPlanOrThrow(args.planId);
  await requireHouseholdMember(args.userId, plan.householdId);

  await db
    .update(plans)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(plans.id, args.planId));
  logger.info("plan_archived", { userId: args.userId, planId: args.planId });
}

export async function unarchivePlan(args: { planId: string; userId: string }): Promise<void> {
  const plan = await loadPlanOrThrow(args.planId);
  await requireHouseholdMember(args.userId, plan.householdId);

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
  await requireHouseholdMember(args.userId, plan.householdId);

  const [meal] = await db
    .select({ id: meals.id, householdId: meals.householdId, archivedAt: meals.archivedAt })
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

  if (inserted) return inserted;

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
  await requireHouseholdMember(args.userId, plan.householdId);

  const [deleted] = await db
    .delete(planDishes)
    .where(
      and(eq(planDishes.id, args.planDishId), eq(planDishes.planId, args.planId))
    )
    .returning({ id: planDishes.id });
  if (!deleted) throw new Error("Plan dish not found.");
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
  await requireHouseholdMember(args.userId, plan.householdId);

  await db.transaction(async (tx) => {
    for (let i = 0; i < args.dishIdsInOrder.length; i++) {
      const dishId = args.dishIdsInOrder[i]!;
      await tx
        .update(planDishes)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(and(eq(planDishes.id, dishId), eq(planDishes.planId, args.planId)));
    }
  });
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
  await requireHouseholdMember(args.userId, plan.householdId);

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
  await requireHouseholdMember(args.userId, source.householdId);

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
  await requireHouseholdMember(args.userId, plan.householdId);

  // Pull every dish on the plan + its current annotation effort, in
  // one query. The most-recent-log lookup is a correlated subquery so
  // we get a single row per dish.
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
    .where(eq(planDishes.planId, args.planId));

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
  await requireHouseholdMember(args.userId, plan.householdId);

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
};

export async function listMealLibrary(args: {
  userId: string;
  householdId: string;
  q?: string;
  limit?: number;
}): Promise<MealLibraryRow[]> {
  await requireHouseholdMember(args.userId, args.householdId);

  const limit = Math.max(1, Math.min(500, args.limit ?? 200));
  const q = args.q?.trim().toLowerCase() ?? "";

  return db
    .select({
      id: meals.id,
      name: meals.name,
      photoUrl: meals.photoUrl
    })
    .from(meals)
    .where(
      and(
        eq(meals.householdId, args.householdId),
        isNull(meals.archivedAt),
        q.length > 0 ? sql`lower(${meals.name}) like ${`%${q}%`}` : undefined
      )
    )
    .orderBy(asc(meals.name))
    .limit(limit);
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

  const rows = await db
    .select({ id: meals.id })
    .from(meals)
    .where(and(eq(meals.householdId, args.householdId), inArray(meals.id, args.mealIds)));
  return rows.map((r) => r.id);
}
