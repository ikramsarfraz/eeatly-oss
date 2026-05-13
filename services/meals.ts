import "server-only";

import { and, count, desc, eq, inArray, isNull, max, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { withSuggestions } from "@/lib/meals/rediscovery";
import { normalizeMealName } from "@/lib/utils";
import { mealLogInputSchema, type MealLogInput } from "@/lib/validators/meals";
import { mealLogs, meals } from "@/db/schema";
import type { DashboardMeals, MealStat, RecentMeal } from "@/types";

function scopeMealsToUser(userId: string) {
  return and(eq(meals.userId, userId), isNull(meals.archivedAt));
}

function activeMealLogsForUser(userId: string) {
  return and(eq(mealLogs.userId, userId), isNull(mealLogs.deletedAt));
}

export async function getDashboardMeals(
  userId: string,
  options?: { suggestionLimit?: number; recentMealsLimit?: number }
): Promise<DashboardMeals> {
  const recentLimit = options?.recentMealsLimit ?? 10;

  // Run all three independent queries in parallel — the original code
  // awaited recentMeals first, which blocked the most/neglected pair from
  // starting and added one DB round-trip's worth of latency to every
  // dashboard render.
  const [recentMeals, mostCookedStats, neglectedStats] = await Promise.all([
    db
      .select({
        id: mealLogs.id,
        mealId: meals.id,
        mealName: meals.name,
        cookedAt: mealLogs.cookedAt,
        effortLevel: mealLogs.effortLevel,
        notes: mealLogs.notes,
        photoUrl: sql<string | null>`coalesce(${mealLogs.photoUrl}, ${meals.photoUrl})`
      })
      .from(mealLogs)
      .innerJoin(meals, eq(mealLogs.mealId, meals.id))
      .where(activeMealLogsForUser(userId))
      .orderBy(desc(mealLogs.cookedAt))
      .limit(recentLimit),

    db
      .select({
        mealId: meals.id,
        mealName: meals.name,
        cookCount: count(mealLogs.id),
        lastCookedAt: max(mealLogs.cookedAt),
        photoUrl: meals.photoUrl,
        recipeText: meals.recipeText,
        recipeSourceUrl: meals.recipeSourceUrl
      })
      .from(meals)
      .innerJoin(mealLogs, and(eq(mealLogs.mealId, meals.id), isNull(mealLogs.deletedAt)))
      .where(scopeMealsToUser(userId))
      .groupBy(meals.id)
      .orderBy(desc(count(mealLogs.id)))
      .limit(6),

    db
      .select({
        mealId: meals.id,
        mealName: meals.name,
        cookCount: count(mealLogs.id),
        lastCookedAt: max(mealLogs.cookedAt),
        photoUrl: meals.photoUrl,
        recipeText: meals.recipeText,
        recipeSourceUrl: meals.recipeSourceUrl
      })
      .from(meals)
      .leftJoin(mealLogs, and(eq(mealLogs.mealId, meals.id), isNull(mealLogs.deletedAt)))
      .where(scopeMealsToUser(userId))
      .groupBy(meals.id)
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

export async function createMealLog(userId: string, input: MealLogInput): Promise<{
  mealLog: (typeof mealLogs.$inferSelect) | undefined;
  mealLogCount: number;
}> {
  const payload = mealLogInputSchema.parse(input);
  const normalizedName = normalizeMealName(payload.mealName);
  const photoUrl = payload.photoUrl || null;
  const notes = payload.notes || null;
  const recipeText = payload.recipeText !== undefined ? (payload.recipeText.trim() || null) : undefined;
  const recipeSourceUrl = payload.recipeSourceUrl !== undefined ? (payload.recipeSourceUrl.trim() || null) : undefined;

  return db.transaction(async (tx) => {
    const existingMeal = await tx.query.meals.findFirst({
      where: and(scopeMealsToUser(userId), eq(meals.normalizedName, normalizedName))
    });

    const meal =
      existingMeal ??
      (
        await tx
          .insert(meals)
          .values({
            userId,
            name: payload.mealName,
            normalizedName,
            photoUrl,
            recipeText: recipeText ?? null,
            recipeSourceUrl: recipeSourceUrl ?? null,
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
          updatedAt: new Date()
        })
        .where(eq(meals.id, existingMeal.id));
    }

    const [log] = await tx
      .insert(mealLogs)
      .values({
        mealId: meal.id,
        userId,
        effortLevel: payload.effortLevel,
        notes,
        cookedAt: payload.cookedDate,
        photoUrl
      })
      .returning();

    const [mealLogCountRow] = await tx
      .select({ value: count(mealLogs.id) })
      .from(mealLogs)
      .where(activeMealLogsForUser(userId));

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
  options: HistoryListOptions = {}
): Promise<{ rows: HistoryRow[]; total: number; page: number; pageSize: number }> {
  const tab = options.tab ?? "recent";
  const sort = options.sort ?? "date";
  const dir = options.dir ?? "desc";
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, Math.min(100, options.pageSize ?? DEFAULT_PAGE_SIZE));
  const offset = (page - 1) * pageSize;

  const baseFilters = [
    activeMealLogsForUser(userId),
    options.effortLevels && options.effortLevels.length > 0
      ? inArray(mealLogs.effortLevel, [...options.effortLevels])
      : undefined,
    typeof options.rangeDays === "number"
      ? sql`${mealLogs.cookedAt}::date >= (current_date - ${options.rangeDays}::int)`
      : undefined,
    options.q && options.q.trim().length > 0
      ? sql`(lower(${meals.name}) like ${`%${options.q.trim().toLowerCase()}%`} or lower(coalesce(${mealLogs.notes}, '')) like ${`%${options.q.trim().toLowerCase()}%`})`
      : undefined
  ].filter(Boolean) as ReturnType<typeof activeMealLogsForUser>[];

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
      db
        .select({
          id: mealLogs.id,
          mealId: meals.id,
          mealName: meals.name,
          cookedAt: mealLogs.cookedAt,
          effortLevel: mealLogs.effortLevel,
          notes: mealLogs.notes,
          photoUrl: sql<string | null>`coalesce(${mealLogs.photoUrl}, ${meals.photoUrl})`
        })
        .from(mealLogs)
        .innerJoin(meals, eq(mealLogs.mealId, meals.id))
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
      tags: []
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
    tags: []
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
export async function getHistoryStats(userId: string): Promise<{
  thisYear: number;
  thisMonth: number;
  neglectedCount: number;
  counts: { recent: number; most: number; neglected: number };
}> {
  const [statsRow, mealAggRows] = await Promise.all([
    db
      .select({
        thisYear: sql<number>`count(*) filter (where date_trunc('year', ${mealLogs.cookedAt}::timestamp) = date_trunc('year', current_date))::int`,
        thisMonth: sql<number>`count(*) filter (where date_trunc('month', ${mealLogs.cookedAt}::timestamp) = date_trunc('month', current_date))::int`,
        totalLogs: count(mealLogs.id)
      })
      .from(mealLogs)
      .where(activeMealLogsForUser(userId)),
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
      .where(scopeMealsToUser(userId))
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

export async function deleteMealLog(userId: string, logId: string): Promise<void> {
  const [updated] = await db
    .update(mealLogs)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(mealLogs.id, logId),
        eq(mealLogs.userId, userId),
        isNull(mealLogs.deletedAt)
      )
    )
    .returning({ id: mealLogs.id });

  if (!updated) {
    throw new Error("Meal log not found.");
  }
}
