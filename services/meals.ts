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

function scopeMealLogsToUser(userId: string) {
  return eq(mealLogs.userId, userId);
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
    .where(scopeMealLogsToUser(userId))
    .orderBy(desc(mealLogs.cookedAt))
    .limit(10);

  const stats = await db
    .select({
      mealId: meals.id,
      mealName: meals.name,
      cookCount: count(mealLogs.id),
      lastCookedAt: max(mealLogs.cookedAt),
      photoUrl: meals.photoUrl
    })
    .from(meals)
    .innerJoin(mealLogs, eq(mealLogs.mealId, meals.id))
    .where(scopeMealsToUser(userId))
    .groupBy(meals.id)
    .orderBy(desc(count(mealLogs.id)))
    .limit(24);

  const normalizedStats: MealStat[] = stats
    .filter((meal): meal is typeof meal & { lastCookedAt: string } =>
      Boolean(meal.lastCookedAt)
    )
    .map((meal) => ({
      mealId: meal.mealId,
      mealName: meal.mealName,
      cookCount: Number(meal.cookCount),
      lastCookedAt: meal.lastCookedAt,
      photoUrl: meal.photoUrl
    }));

  const mostCookedMeals = normalizedStats.slice(0, 6);
  const neglectedMeals = [...normalizedStats]
    .sort((a, b) => a.lastCookedAt.localeCompare(b.lastCookedAt))
    .slice(0, 6);

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
      .where(scopeMealLogsToUser(userId));

    const mealLogCount = Number(mealLogCountRow?.value ?? 0);

    return { mealLog: log, mealLogCount };
  });
}
