import "server-only";

import { and, count, desc, eq, isNull, max, sql } from "drizzle-orm";
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

export async function getDashboardMeals(userId: string): Promise<DashboardMeals> {
  const recentMeals = await db
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
    .limit(10);

  const [mostCookedStats, neglectedStats] = await Promise.all([
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

  return withSuggestions(recentMeals as RecentMeal[], mostCookedMeals, neglectedMeals);
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
