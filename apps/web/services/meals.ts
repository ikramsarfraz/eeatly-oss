import "server-only";

import { and, asc, count, desc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { requireHouseholdMember } from "@/lib/auth/session";
import { withSuggestions } from "@/lib/meals/rediscovery";
import { mealVisibilityFilter } from "@/lib/meals/visibility";
import { normalizeMealName } from "@/lib/utils";
import { mealLogInputSchema, type MealLogInput } from "@eeatly/api/validators/meals";
import {
  dishImages,
  mealIngredients,
  mealLogs,
  meals,
  recipeSteps,
  users
} from "@/db/schema";
import type { DashboardMeals, MealStat, RecentMeal } from "@/types";

// Round-4 scopes are household-level. The first arg of every public service
// fn is the calling user's id (for the membership check); the second is the
// household id the request targets. requireHouseholdMember runs at the top
// of each so cross-household access fails fast with a logged error.
//
// Round 32 — this helper deliberately STAYS visibility-free. It scopes
// to a household + drops soft-archived rows; the visibility predicate
// (`mealVisibilityFilter`) is applied separately at every READ site
// where it's intentional. The WRITE-path upsert in `createMealLog`
// must NOT filter by visibility — otherwise B trying to log a meal
// whose normalized name collides with A's personal meal would fail
// the unique index. The whole point of the household-wide name index
// is to deduplicate across visibility states.
function scopeMealsToHousehold(householdId: string) {
  return and(eq(meals.householdId, householdId), isNull(meals.archivedAt));
}

// Round 32 — logs are filtered by household + soft-delete; the joined
// meal's visibility is applied separately at every read site (history,
// dashboard recent, ideas) so a member can't see a log against another
// member's personal meal. Logs themselves don't carry a visibility
// flag — they inherit it from the meal they reference.
function activeMealLogsForHousehold(householdId: string) {
  return and(eq(mealLogs.householdId, householdId), isNull(mealLogs.deletedAt));
}

export async function getDashboardMeals(
  userId: string,
  householdId: string,
  options?: { suggestionLimit?: number; recentMealsLimit?: number }
): Promise<DashboardMeals> {
  await requireHouseholdMember(userId, householdId);

  const recentLimit = options?.recentMealsLimit ?? 10;

  // Run all three independent queries in parallel — the original code
  // awaited recentMeals first, which blocked the most/neglected pair from
  // starting and added one DB round-trip's worth of latency to every
  // dashboard render.
  const [recentMeals, mostCookedStats, neglectedStats] = await Promise.all([
    // LEFT JOIN on users because Round 4.7 made cooked_by_user_id nullable
    // (FK ON DELETE SET NULL preserves the log when the cook is deleted).
    // INNER JOIN would silently drop rows with null attribution and break
    // the Round 4.5 contract that cooking history stays in the household.
    db
      .select({
        id: mealLogs.id,
        mealId: meals.id,
        mealName: meals.name,
        cookedAt: mealLogs.cookedAt,
        effortLevel: mealLogs.effortLevel,
        notes: mealLogs.notes,
        // Fallback order: this cook's own photo → the meal's own photo →
        // the app-wide AI dish image. Failed dish-image rows carry a null
        // image_url, so coalesce skips them automatically.
        photoUrl: sql<string | null>`coalesce(${mealLogs.photoUrl}, ${meals.photoUrl}, ${dishImages.imageUrl})`,
        cookedByUserId: mealLogs.cookedByUserId,
        cookedByName: users.name
      })
      .from(mealLogs)
      .innerJoin(meals, eq(mealLogs.mealId, meals.id))
      .leftJoin(dishImages, eq(dishImages.normalizedName, meals.normalizedName))
      .leftJoin(users, eq(users.id, mealLogs.cookedByUserId))
      // R32 — recent-cooks join hits meals, so the visibility predicate
      // applies to the joined row. Another member's personal meal that
      // somehow has a log against it (e.g. legacy data, or future
      // cross-user logging) is excluded here.
      .where(
        and(
          activeMealLogsForHousehold(householdId),
          mealVisibilityFilter(userId, householdId)
        )
      )
      .orderBy(desc(mealLogs.cookedAt))
      .limit(recentLimit),

    db
      .select({
        mealId: meals.id,
        mealName: meals.name,
        cookCount: count(mealLogs.id),
        lastCookedAt: max(mealLogs.cookedAt),
        photoUrl: sql<string | null>`coalesce(${meals.photoUrl}, ${dishImages.imageUrl})`,
        recipeText: meals.recipeText,
        recipeSourceUrl: meals.recipeSourceUrl
      })
      .from(meals)
      .innerJoin(mealLogs, and(eq(mealLogs.mealId, meals.id), isNull(mealLogs.deletedAt)))
      .leftJoin(dishImages, eq(dishImages.normalizedName, meals.normalizedName))
      .where(
        and(
          scopeMealsToHousehold(householdId),
          mealVisibilityFilter(userId, householdId)
        )
      )
      // dishImages.imageUrl belongs to a joined table (not the grouped
      // PK's table), so Postgres requires it in GROUP BY. One row per
      // normalizedName means it stays constant within each meal.id group.
      .groupBy(meals.id, dishImages.imageUrl)
      .orderBy(desc(count(mealLogs.id)))
      .limit(6),

    db
      .select({
        mealId: meals.id,
        mealName: meals.name,
        cookCount: count(mealLogs.id),
        lastCookedAt: max(mealLogs.cookedAt),
        photoUrl: sql<string | null>`coalesce(${meals.photoUrl}, ${dishImages.imageUrl})`,
        recipeText: meals.recipeText,
        recipeSourceUrl: meals.recipeSourceUrl
      })
      .from(meals)
      .leftJoin(mealLogs, and(eq(mealLogs.mealId, meals.id), isNull(mealLogs.deletedAt)))
      .leftJoin(dishImages, eq(dishImages.normalizedName, meals.normalizedName))
      .where(
        and(
          scopeMealsToHousehold(householdId),
          mealVisibilityFilter(userId, householdId)
        )
      )
      .groupBy(meals.id, dishImages.imageUrl)
      .orderBy(sql`max(${mealLogs.cookedAt}) asc nulls first`)
      .limit(18)
  ]);

  const toMealStat = (meal: typeof mostCookedStats[number]): MealStat => ({
    mealId: meal.mealId,
    mealName: meal.mealName,
    cookCount: Number(meal.cookCount),
    lastCookedAt: meal.lastCookedAt,
    photoUrl: meal.photoUrl,
    recipeText: meal.recipeText,
    recipeSourceUrl: meal.recipeSourceUrl
  });

  const mostCookedMeals = mostCookedStats.map(toMealStat);

  const mostCookedIds = new Set(mostCookedStats.map((m) => m.mealId));
  const neglectedMeals = neglectedStats
    .filter((m) => !mostCookedIds.has(m.mealId))
    .slice(0, 6)
    .map(toMealStat);

  return withSuggestions(
    recentMeals as RecentMeal[],
    mostCookedMeals,
    neglectedMeals,
    options?.suggestionLimit
  );
}

/**
 * Round 32 — new meals default to `shared`. `createMealLog` always sets
 * `sharedAt = new Date()` on insert. There's no client-visible toggle
 * for the default; the reverse action ("Move to personal") lives on
 * Recipe Detail after creation. An optional `shared` field on the
 * payload exists as a future-proofing knob — today the schema doesn't
 * surface it, but the service-layer parameter would slot in here if it
 * does, and the default would remain `true`.
 */
export async function createMealLog(
  userId: string,
  householdId: string,
  input: MealLogInput,
  options?: { shared?: boolean }
): Promise<{
  mealLog: (typeof mealLogs.$inferSelect) | undefined;
  mealLogCount: number;
}> {
  await requireHouseholdMember(userId, householdId);

  const payload = mealLogInputSchema.parse(input);
  const normalizedName = normalizeMealName(payload.mealName);
  const photoUrl = payload.photoUrl || null;
  const notes = payload.notes || null;
  const recipeText = payload.recipeText !== undefined ? (payload.recipeText.trim() || null) : undefined;
  const recipeSourceUrl = payload.recipeSourceUrl !== undefined ? (payload.recipeSourceUrl.trim() || null) : undefined;
  // Round 10: pass-through. `undefined` = caller didn't touch ingredients
  // (preserve whatever the existing meal already has); empty array also
  // means "no ingredients to save" so we coerce to null on persist to
  // match the recipeText convention.
  const ingredients = (() => {
    if (payload.ingredients === undefined) return undefined;
    const cleaned = payload.ingredients
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    return cleaned.length > 0 ? cleaned : null;
  })();

  return db.transaction(async (tx) => {
    // Match against the household's existing meal by normalized name —
    // the post-0016 unique index is (household_id, normalized_name), so
    // any duplicate is the right one to merge into.
    const existingMeal = await tx.query.meals.findFirst({
      where: and(scopeMealsToHousehold(householdId), eq(meals.normalizedName, normalizedName))
    });

    const meal =
      existingMeal ??
      (
        await tx
          .insert(meals)
          .values({
            householdId,
            // Attribution: who first added this recipe to the household.
            // Set only on insert; never overwritten on subsequent logs by
            // other household members.
            createdByUserId: userId,
            name: payload.mealName,
            normalizedName,
            photoUrl,
            recipeText: recipeText ?? null,
            recipeSourceUrl: recipeSourceUrl ?? null,
            ingredients: ingredients ?? null,
            // R32 — new meals default to shared. The `shared` option is
            // an explicit future-proofing knob (no client surface today).
            // Setting `sharedAt = now()` preserves the "shared by default"
            // behavior the round established; callers that explicitly
            // pass `shared: false` get a personal meal on creation.
            sharedAt: options?.shared === false ? null : new Date(),
            updatedAt: new Date()
          })
          .returning()
      )[0];

    if (!meal) {
      throw new Error("Unable to create meal.");
    }

    if (existingMeal) {
      await tx
        .update(meals)
        .set({
          photoUrl: photoUrl && !existingMeal.photoUrl ? photoUrl : existingMeal.photoUrl,
          ...(recipeText !== undefined && { recipeText }),
          ...(recipeSourceUrl !== undefined && { recipeSourceUrl }),
          ...(ingredients !== undefined && { ingredients }),
          updatedAt: new Date()
        })
        .where(eq(meals.id, existingMeal.id));
      // NB: existingMeal.createdByUserId is preserved — attribution sticks
      // with the first member who added this recipe.
    }

    const [log] = await tx
      .insert(mealLogs)
      .values({
        mealId: meal.id,
        householdId,
        cookedByUserId: userId,
        effortLevel: payload.effortLevel,
        notes,
        cookedAt: payload.cookedDate,
        photoUrl
      })
      .returning();

    // mealLogCount is per-USER for activation funnel events (first / second
    // meal milestones in actions/meals.ts). Household-scoped wouldn't work
    // — a new member joining a multi-user household would never see "first
    // meal" because someone else already logged one.
    const [mealLogCountRow] = await tx
      .select({ value: count(mealLogs.id) })
      .from(mealLogs)
      .where(
        and(eq(mealLogs.cookedByUserId, userId), isNull(mealLogs.deletedAt))
      );

    const mealLogCount = Number(mealLogCountRow?.value ?? 0);

    return { mealLog: log, mealLogCount };
  });
}

export type HistoryTab = "recent" | "most" | "neglected";

export type HistorySortField = "date" | "name";

export type HistorySortDir = "asc" | "desc";

export type HistoryRow = {
  id: string;
  mealId: string;
  mealName: string;
  cookedAt: string;
  effortLevel: typeof mealLogs.$inferSelect.effortLevel;
  notes: string | null;
  photoUrl: string | null;
  tags: string[];
  /**
   * Round-4 attribution. Populated on the `recent` (log-level) tab; null on
   * aggregate tabs (`most`, `neglected`) where many cooks may share a row.
   * The UI hides attribution when null OR when the cook is the viewer.
   */
  cookedByUserId: string | null;
  cookedByName: string | null;
};

export type HistoryListOptions = {
  tab?: HistoryTab;
  sort?: HistorySortField;
  dir?: HistorySortDir;
  page?: number;
  pageSize?: number;
  effortLevels?: ReadonlyArray<typeof mealLogs.$inferSelect.effortLevel>;
  /** Days from "now" to include — null means no time filter. */
  rangeDays?: number | null;
  /** Substring filter (case-insensitive) over meal name + notes. */
  q?: string;
};

const DEFAULT_PAGE_SIZE = 20;

/**
 * Server-side paginated query for the /history page. Distinct from the
 * dashboard's `getDashboardMeals` because the request shapes are different
 * — history needs URL-driven sort/filter/pagination, dashboard only needs
 * a fixed slice + aggregates.
 *
 * The `most` and `neglected` tabs aggregate by meal (one row per meal,
 * with cook count + last cooked); `recent` returns log rows directly.
 * For now both code paths return `HistoryRow[]` — the meal-level tabs
 * embed the most recent log's effort and notes for consistent rendering.
 */
export async function getHistoryRows(
  userId: string,
  householdId: string,
  options: HistoryListOptions = {}
): Promise<{ rows: HistoryRow[]; total: number; page: number; pageSize: number }> {
  await requireHouseholdMember(userId, householdId);

  const tab = options.tab ?? "recent";
  const sort = options.sort ?? "date";
  const dir = options.dir ?? "desc";
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, options.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;

  const baseFilters = [
    activeMealLogsForHousehold(householdId),
    // R32 — history rows always join meals, so the visibility filter
    // applies to the joined meal row. Without this, a member could see
    // log entries pointing at another member's personal meal in their
    // history. The unique household-name index makes that situation
    // narrow but real (e.g. a user removed from the household leaving
    // logs behind), so we filter defensively.
    mealVisibilityFilter(userId, householdId),
    options.effortLevels && options.effortLevels.length > 0
      ? inArray(mealLogs.effortLevel, [...options.effortLevels])
      : undefined,
    typeof options.rangeDays === "number"
      ? sql`${mealLogs.cookedAt}::date >= (current_date - ${options.rangeDays}::int)`
      : undefined,
    options.q && options.q.trim().length > 0
      ? sql`(lower(${meals.name}) like ${`%${options.q.trim().toLowerCase()}%`} or lower(coalesce(${mealLogs.notes}, '')) like ${`%${options.q.trim().toLowerCase()}%`})`
      : undefined
  ].filter(Boolean) as ReturnType<typeof activeMealLogsForHousehold>[];

  const where = baseFilters.length === 1 ? baseFilters[0] : and(...baseFilters);

  if (tab === "recent") {
    const orderClause =
      sort === "name"
        ? dir === "asc"
          ? meals.name
          : desc(meals.name)
        : dir === "asc"
          ? mealLogs.cookedAt
          : desc(mealLogs.cookedAt);

    const [rowsResult, totalResult] = await Promise.all([
      // LEFT JOIN on users — see comment on getDashboardMeals recent query.
      db
        .select({
          id: mealLogs.id,
          mealId: meals.id,
          mealName: meals.name,
          cookedAt: mealLogs.cookedAt,
          effortLevel: mealLogs.effortLevel,
          notes: mealLogs.notes,
          photoUrl: sql<string | null>`coalesce(${mealLogs.photoUrl}, ${meals.photoUrl})`,
          cookedByUserId: mealLogs.cookedByUserId,
          cookedByName: users.name
        })
        .from(mealLogs)
        .innerJoin(meals, eq(mealLogs.mealId, meals.id))
        .leftJoin(users, eq(users.id, mealLogs.cookedByUserId))
        .where(where)
        .orderBy(orderClause)
        .limit(pageSize)
        .offset(offset),
      db
        .select({ value: count(mealLogs.id) })
        .from(mealLogs)
        .innerJoin(meals, eq(mealLogs.mealId, meals.id))
        .where(where)
    ]);

    const rows: HistoryRow[] = rowsResult.map((r) => ({
      id: r.id,
      mealId: r.mealId,
      mealName: r.mealName,
      cookedAt: r.cookedAt,
      effortLevel: r.effortLevel,
      notes: r.notes,
      photoUrl: r.photoUrl,
      tags: [],
      cookedByUserId: r.cookedByUserId,
      cookedByName: r.cookedByName
    }));

    return {
      rows,
      total: Number(totalResult[0]?.value ?? 0),
      page,
      pageSize
    };
  }

  // most / neglected — aggregate by meal.
  // Build a sub-aggregate, then either order by cook count desc (most) or
  // last-cooked asc (neglected). Both reuse the same shape and project the
  // most recent log's effort/notes via a lateral-ish pattern: cheaper to
  // do a follow-up query that pulls the latest log per meal, but for now
  // we surface the meal-level info and leave effort/notes empty on the
  // aggregate row. The UI doesn't render notes on most-cooked anyway.
  const aggregateOrder =
    tab === "most"
      ? sort === "name"
        ? dir === "asc"
          ? meals.name
          : desc(meals.name)
        : dir === "asc"
          ? count(mealLogs.id)
          : desc(count(mealLogs.id))
      : sort === "name"
        ? dir === "asc"
          ? meals.name
          : desc(meals.name)
        : dir === "asc"
          ? sql`max(${mealLogs.cookedAt}) desc nulls last`
          : sql`max(${mealLogs.cookedAt}) asc nulls first`;

  const aggregateWhere = baseFilters.length === 1
    ? baseFilters[0]
    : and(...baseFilters);

  const [rowsResult, totalResult] = await Promise.all([
    db
      .select({
        mealId: meals.id,
        mealName: meals.name,
        lastCookedAt: max(mealLogs.cookedAt),
        photoUrl: meals.photoUrl
      })
      .from(meals)
      .innerJoin(
        mealLogs,
        and(eq(mealLogs.mealId, meals.id), isNull(mealLogs.deletedAt))
      )
      .where(aggregateWhere)
      .groupBy(meals.id)
      .orderBy(aggregateOrder)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ value: count(sql<number>`distinct ${meals.id}`) })
      .from(meals)
      .innerJoin(
        mealLogs,
        and(eq(mealLogs.mealId, meals.id), isNull(mealLogs.deletedAt))
      )
      .where(aggregateWhere)
  ]);

  const rows: HistoryRow[] = rowsResult.map((r) => ({
    id: r.mealId,
    mealId: r.mealId,
    mealName: r.mealName,
    cookedAt: r.lastCookedAt ?? new Date().toISOString().slice(0, 10),
    effortLevel: "easy",
    notes: null,
    photoUrl: r.photoUrl,
    tags: [],
    // Aggregate rows span multiple cooks — no single attribution makes sense.
    cookedByUserId: null,
    cookedByName: null
  }));

  return {
    rows,
    total: Number(totalResult[0]?.value ?? 0),
    page,
    pageSize
  };
}

/**
 * Aggregates the /history page header shows + tab counters. Kept separate
 * from `getHistoryRows` so the page can fire row fetch + stats in parallel
 * without coupling their SQL shape.
 */
export async function getHistoryStats(
  userId: string,
  householdId: string
): Promise<{
  thisYear: number;
  thisMonth: number;
  neglectedCount: number;
  counts: { recent: number; most: number; neglected: number };
}> {
  await requireHouseholdMember(userId, householdId);

  const [statsRow, mealAggRows] = await Promise.all([
    // R32 — totals are joined to meals via mealId so we can apply the
    // visibility filter; without it, a member would see counts that
    // include other members' personal-meal logs in their household
    // aggregates. Visibility is folded in via the inner join's WHERE
    // clause.
    db
      .select({
        thisYear: sql<number>`count(*) filter (where date_trunc('year', ${mealLogs.cookedAt}::timestamp) = date_trunc('year', current_date))::int`,
        thisMonth: sql<number>`count(*) filter (where date_trunc('month', ${mealLogs.cookedAt}::timestamp) = date_trunc('month', current_date))::int`,
        totalLogs: count(mealLogs.id)
      })
      .from(mealLogs)
      .innerJoin(meals, eq(mealLogs.mealId, meals.id))
      .where(
        and(
          activeMealLogsForHousehold(householdId),
          mealVisibilityFilter(userId, householdId)
        )
      ),
    db
      .select({
        mealId: meals.id,
        cookCount: count(mealLogs.id),
        lastCookedAt: max(mealLogs.cookedAt)
      })
      .from(meals)
      .innerJoin(
        mealLogs,
        and(eq(mealLogs.mealId, meals.id), isNull(mealLogs.deletedAt))
      )
      .where(
        and(
          scopeMealsToHousehold(householdId),
          mealVisibilityFilter(userId, householdId)
        )
      )
      .groupBy(meals.id)
  ]);

  const today = new Date();
  const cutoff = new Date(today.getTime() - 21 * 24 * 60 * 60 * 1000);
  const cutoffIso = cutoff.toISOString().slice(0, 10);

  let mostCount = 0;
  let neglectedCount = 0;
  for (const row of mealAggRows) {
    if (Number(row.cookCount) >= 2) mostCount += 1;
    if (row.lastCookedAt && row.lastCookedAt < cutoffIso) neglectedCount += 1;
  }

  return {
    thisYear: Number(statsRow[0]?.thisYear ?? 0),
    thisMonth: Number(statsRow[0]?.thisMonth ?? 0),
    neglectedCount,
    counts: {
      recent: Number(statsRow[0]?.totalLogs ?? 0),
      most: mostCount,
      neglected: neglectedCount
    }
  };
}

/**
 * Round 10 — recipe view (`/meal/[id]`). Returns everything the page
 * needs in a single round-trip: the meal row, the household member's
 * attribution for the original add, the most-recent cook timestamp,
 * the cook count, and the cooker's name on the most recent log.
 *
 * Returns `null` when the meal doesn't exist OR is archived OR doesn't
 * belong to the caller's household. We don't distinguish those at the
 * service layer — the page renders the same `notFound()` for all three
 * to avoid leaking which other households a stranger could enumerate.
 *
 * Authz: `requireHouseholdMember` runs first. A non-member calling with
 * a guessed (mealId, householdId) tuple lands in the "Not authorized"
 * logged-error branch, NOT the silent null branch.
 */
export type MealDetailView = {
  id: string;
  name: string;
  photoUrl: string | null;
  recipeText: string | null;
  recipeSourceUrl: string | null;
  ingredients: string[] | null;
  notes: string | null;
  createdByUserId: string | null;
  createdByName: string | null;
  cookCount: number;
  lastCookedAt: string | null;
  createdAt: string;
  /**
   * Round 32 — meal sharing flag. `null` = personal (only the creator
   * sees the meal); ISO timestamp = when it became shared with the
   * household. The Recipe Detail view renders a "Personal" / "Shared"
   * chip off this field, and the TopBar's share affordance branches on
   * whether the viewer is the creator and the current sharing state.
   */
  sharedAt: string | null;
  /**
   * Modal effort across all logs of this meal — `null` when there are
   * no logs yet (a meal can be added without being cooked, e.g. via
   * AI re-extract flows that save a recipe before the first cook).
   *
   * "Modal" rather than "most recent" so a one-off weeknight rush
   * doesn't override the typical effort the cook reaches for. Ties
   * resolve toward the heavier effort (`high_effort` > `medium` >
   * `easy` > `quick`) — better to over-prepare than under.
   */
  effortLevel: "quick" | "easy" | "medium" | "high_effort" | null;
  /**
   * Round 18 — structured ingredient rows. Empty when the meal predates
   * the structured-ingredient migration (Refine save path). Mobile readers
   * prefer this when populated and fall back to `ingredients: string[]`
   * (the R10 free-form array) when empty.
   */
  structuredIngredients: Array<{
    id: string;
    position: number;
    name: string;
    quantityString: string;
    prepNote: string | null;
  }>;
  /**
   * Round 18 — structured step rows. Empty when the meal predates the
   * Refine flow. Readers prefer this when populated and fall back to
   * `recipeText` (the R7 prose blob) when empty.
   */
  structuredSteps: Array<{
    id: string;
    position: number;
    title: string;
    time: string | null;
    body: string;
    ingredientIds: string[];
  }>;
};

export async function getMealDetail(
  userId: string,
  householdId: string,
  mealId: string
): Promise<MealDetailView | null> {
  await requireHouseholdMember(userId, householdId);

  const [row] = await db
    .select({
      id: meals.id,
      name: meals.name,
      // Own photo wins; the app-wide AI dish image is the fallback. SSR
      // therefore shows a generated image immediately on repeat visits
      // (the client only fires generation when this resolves to null).
      photoUrl: sql<string | null>`coalesce(${meals.photoUrl}, ${dishImages.imageUrl})`,
      recipeText: meals.recipeText,
      recipeSourceUrl: meals.recipeSourceUrl,
      ingredients: meals.ingredients,
      notes: meals.notes,
      sharedAt: meals.sharedAt,
      createdAt: meals.createdAt,
      createdByUserId: meals.createdByUserId,
      createdByName: users.name
    })
    .from(meals)
    .leftJoin(users, eq(users.id, meals.createdByUserId))
    .leftJoin(dishImages, eq(dishImages.normalizedName, meals.normalizedName))
    // R32 — visibility filter folded in. A direct navigation to a
    // mealId that's another member's personal meal returns null here
    // — the calling page renders `notFound()` exactly like it does
    // for cross-household IDs, so we don't leak the meal's existence
    // through error messages.
    .where(
      and(
        eq(meals.id, mealId),
        eq(meals.householdId, householdId),
        isNull(meals.archivedAt),
        mealVisibilityFilter(userId, householdId)
      )
    )
    .limit(1);

  if (!row) return null;

  // Cook count + last-cooked roll-up. Joined separately so the meal row
  // returns even when there are no logs (a meal can be added without
  // being logged via legacy paths or via Task 5 re-extract flows).
  const [stats] = await db
    .select({
      cookCount: count(mealLogs.id),
      lastCookedAt: max(mealLogs.cookedAt)
    })
    .from(mealLogs)
    .where(
      and(
        eq(mealLogs.mealId, mealId),
        eq(mealLogs.householdId, householdId),
        isNull(mealLogs.deletedAt)
      )
    );

  // Modal effort — count logs per effort bucket so the recipe-detail
  // chip reflects the typical effort the cook reaches for, not the
  // last (possibly atypical) cook. Empty rows produce 0 counts; we
  // fall back to `null` when there are no logs at all.
  const effortRows = await db
    .select({
      effortLevel: mealLogs.effortLevel,
      n: count(mealLogs.id)
    })
    .from(mealLogs)
    .where(
      and(
        eq(mealLogs.mealId, mealId),
        eq(mealLogs.householdId, householdId),
        isNull(mealLogs.deletedAt)
      )
    )
    .groupBy(mealLogs.effortLevel);

  // Round 18 — structured ingredient + step rows. The Refine save path
  // (R18) writes here; legacy meals stay empty until a Refine round-trip
  // upgrades them. Read both in parallel and let the mobile UI pick
  // structured-when-present, legacy-when-not.
  const [structuredIngredientRows, structuredStepRows] = await Promise.all([
    db
      .select({
        id: mealIngredients.id,
        position: mealIngredients.position,
        name: mealIngredients.name,
        quantityString: mealIngredients.quantityString,
        prepNote: mealIngredients.prepNote
      })
      .from(mealIngredients)
      .where(eq(mealIngredients.mealId, mealId))
      .orderBy(asc(mealIngredients.position)),
    db
      .select({
        id: recipeSteps.id,
        position: recipeSteps.position,
        title: recipeSteps.title,
        time: recipeSteps.time,
        body: recipeSteps.body,
        ingredientIds: recipeSteps.ingredientIds
      })
      .from(recipeSteps)
      .where(eq(recipeSteps.mealId, mealId))
      .orderBy(asc(recipeSteps.position))
  ]);

  return {
    id: row.id,
    name: row.name,
    photoUrl: row.photoUrl,
    recipeText: row.recipeText,
    recipeSourceUrl: row.recipeSourceUrl,
    ingredients: row.ingredients,
    notes: row.notes,
    createdByUserId: row.createdByUserId,
    createdByName: row.createdByName,
    cookCount: Number(stats?.cookCount ?? 0),
    lastCookedAt: stats?.lastCookedAt ?? null,
    createdAt: row.createdAt.toISOString(),
    sharedAt: row.sharedAt ? row.sharedAt.toISOString() : null,
    effortLevel: pickModalEffort(effortRows),
    structuredIngredients: structuredIngredientRows,
    structuredSteps: structuredStepRows
  };
}

/**
 * Pick the most-frequent effort across logs. Ties resolve toward the
 * heavier effort so the chip reads slightly conservative rather than
 * optimistic. Returns `null` when there are no logs.
 */
function pickModalEffort(
  rows: ReadonlyArray<{
    effortLevel: "quick" | "easy" | "medium" | "high_effort";
    n: number;
  }>
): "quick" | "easy" | "medium" | "high_effort" | null {
  if (rows.length === 0) return null;
  const weight: Record<"quick" | "easy" | "medium" | "high_effort", number> = {
    quick: 0,
    easy: 1,
    medium: 2,
    high_effort: 3
  };
  let best = rows[0];
  for (const r of rows) {
    if (
      Number(r.n) > Number(best.n) ||
      (Number(r.n) === Number(best.n) && weight[r.effortLevel] > weight[best.effortLevel])
    ) {
      best = r;
    }
  }
  return best.effortLevel;
}

/**
 * Round 32 — flip a meal's `sharedAt` timestamp. Idempotent: re-sharing
 * an already-shared meal moves the timestamp forward; that's fine
 * (the spec accepts this). Creator-only auth enforced at the procedure
 * layer; this service-level check is defense-in-depth so any future
 * caller can't bypass authz.
 */
export async function shareMeal(args: {
  userId: string;
  householdId: string;
  mealId: string;
}): Promise<{ sharedAt: Date }> {
  await requireHouseholdMember(args.userId, args.householdId);

  const [row] = await db
    .select({
      id: meals.id,
      householdId: meals.householdId,
      createdByUserId: meals.createdByUserId,
      archivedAt: meals.archivedAt
    })
    .from(meals)
    .where(eq(meals.id, args.mealId))
    .limit(1);
  if (!row) throw new Error("Meal not found.");
  if (row.archivedAt) throw new Error("Meal is archived.");
  if (row.householdId !== args.householdId) {
    throw new Error("Meal not in this household.");
  }
  if (row.createdByUserId !== args.userId) {
    throw new Error("Only the creator can share this meal.");
  }

  const sharedAt = new Date();
  await db
    .update(meals)
    .set({ sharedAt, updatedAt: new Date() })
    .where(eq(meals.id, args.mealId));
  return { sharedAt };
}

/**
 * Round 32 — flip a shared meal back to personal. Idempotent: unsharing
 * an already-personal meal is a no-op (the predicate is symmetric).
 */
export async function unshareMeal(args: {
  userId: string;
  householdId: string;
  mealId: string;
}): Promise<{ sharedAt: null }> {
  await requireHouseholdMember(args.userId, args.householdId);

  const [row] = await db
    .select({
      id: meals.id,
      householdId: meals.householdId,
      createdByUserId: meals.createdByUserId,
      archivedAt: meals.archivedAt
    })
    .from(meals)
    .where(eq(meals.id, args.mealId))
    .limit(1);
  if (!row) throw new Error("Meal not found.");
  if (row.archivedAt) throw new Error("Meal is archived.");
  if (row.householdId !== args.householdId) {
    throw new Error("Meal not in this household.");
  }
  if (row.createdByUserId !== args.userId) {
    throw new Error("Only the creator can change sharing on this meal.");
  }

  await db
    .update(meals)
    .set({ sharedAt: null, updatedAt: new Date() })
    .where(eq(meals.id, args.mealId));
  return { sharedAt: null };
}

/**
 * Set (or replace) a meal's own photo from a device upload. Creator-only,
 * mirroring the share/unshare write lockdown: any member can view a shared
 * meal, but only the creator edits it. The URL is already an uploaded R2
 * object (the client ran the presign flow first), so we just persist it.
 * This `meals.photo_url` always wins over the app-wide `dish_images`
 * fallback at read time.
 */
export async function setMealPhoto(args: {
  userId: string;
  householdId: string;
  mealId: string;
  photoUrl: string;
}): Promise<{ photoUrl: string }> {
  await requireHouseholdMember(args.userId, args.householdId);

  const [row] = await db
    .select({
      id: meals.id,
      householdId: meals.householdId,
      createdByUserId: meals.createdByUserId,
      archivedAt: meals.archivedAt
    })
    .from(meals)
    .where(eq(meals.id, args.mealId))
    .limit(1);
  if (!row) throw new Error("Meal not found.");
  if (row.archivedAt) throw new Error("Meal is archived.");
  if (row.householdId !== args.householdId) {
    throw new Error("Meal not in this household.");
  }
  if (row.createdByUserId !== args.userId) {
    throw new Error("Only the creator can change this meal's photo.");
  }

  await db
    .update(meals)
    .set({ photoUrl: args.photoUrl, updatedAt: new Date() })
    .where(eq(meals.id, args.mealId));
  return { photoUrl: args.photoUrl };
}

export async function deleteMealLog(
  userId: string,
  householdId: string,
  logId: string
): Promise<void> {
  await requireHouseholdMember(userId, householdId);

  // Household trust model: any member can delete any log in the shared
  // kitchen. Authorization is "user is in this household AND log is in
  // this household." Notably NOT scoped to cookedByUserId — that would
  // be cook-only deletion, which can be added later if households want
  // that policy.
  const [updated] = await db
    .update(mealLogs)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(mealLogs.id, logId),
        eq(mealLogs.householdId, householdId),
        isNull(mealLogs.deletedAt)
      )
    )
    .returning({ id: mealLogs.id });

  if (!updated) {
    throw new Error("Meal log not found.");
  }
}
