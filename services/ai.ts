import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { withFallback } from "@/lib/ai/providers";
import * as anthropic from "@/lib/ai/providers/anthropic";
import * as openai from "@/lib/ai/providers/openai";
import { mealLogs, meals } from "@/db/schema";
import type { MealSuggestion, ShareActionResult } from "@/types";

const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

export async function suggestMealFromImage(
  imageBase64: string,
  mediaType: string
): Promise<MealSuggestion> {
  if (!(SUPPORTED_MEDIA_TYPES as readonly string[]).includes(mediaType)) {
    throw new Error(
      `Unsupported image type: ${mediaType}. Please use JPEG, PNG, GIF, or WebP.`
    );
  }

  return withFallback(
    () => openai.suggestMealFromImage(imageBase64, mediaType),
    () => anthropic.suggestMealFromImage(imageBase64, mediaType),
    { operation: "suggest_meal_from_image" }
  );
}

export async function suggestMealFromText(text: string): Promise<MealSuggestion> {
  if (!text.trim()) {
    throw new Error("Please paste some text before requesting a suggestion.");
  }

  return withFallback(
    () => openai.suggestMealFromText(text),
    () => anthropic.suggestMealFromText(text),
    { operation: "suggest_meal_from_text" }
  );
}

export async function generateShareableRecipe(
  mealId: string,
  userId: string
): Promise<ShareActionResult> {
  const meal = await db.query.meals.findFirst({
    where: and(eq(meals.id, mealId), eq(meals.userId, userId), isNull(meals.archivedAt))
  });

  if (!meal) {
    return { ok: false, code: "AI_ERROR", message: "Meal not found." };
  }

  if (!meal.recipeText?.trim()) {
    return { ok: false, code: "RECIPE_MISSING", message: "This meal doesn't have a recipe saved yet." };
  }

  const latestLog = await db.query.mealLogs.findFirst({
    where: and(eq(mealLogs.mealId, mealId), eq(mealLogs.userId, userId), isNull(mealLogs.deletedAt)),
    orderBy: desc(mealLogs.cookedAt)
  });

  try {
    const { text } = await withFallback(
      () => openai.generateShareText(meal.name, meal.recipeText!, latestLog?.notes),
      () => anthropic.generateShareText(meal.name, meal.recipeText!, latestLog?.notes),
      { operation: "generate_share_text" }
    );
    return { ok: true, text };
  } catch {
    return { ok: false, code: "AI_ERROR", message: "AI did not generate a recipe. Try again." };
  }
}
