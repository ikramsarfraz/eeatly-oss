import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { withFallback } from "@/lib/ai/providers";
import * as anthropic from "@/lib/ai/providers/anthropic";
import * as openai from "@/lib/ai/providers/openai";
import { households, mealLogs, meals } from "@/db/schema";
import { requireHouseholdMember } from "@/lib/auth/session";
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
  userId: string,
  householdId: string,
  mealId: string
): Promise<ShareActionResult> {
  // Service-layer authz: matches the pattern in services/meals.ts. The
  // action also verifies household membership via requireCurrentUserWithHousehold,
  // but we re-check here as defense-in-depth so any future caller can't
  // accidentally bypass the gate. Memoized via React cache() so the
  // extra call costs nothing within the same request.
  await requireHouseholdMember(userId, householdId);

  // Round 4: scope by household, not user. Any member can generate a
  // share text for a meal that belongs to their household. The household
  // name is woven into the share-message attribution line, so we pull
  // both in one query rather than a second round-trip.
  const [mealRow] = await db
    .select({
      id: meals.id,
      name: meals.name,
      recipeText: meals.recipeText,
      householdName: households.name
    })
    .from(meals)
    .innerJoin(households, eq(households.id, meals.householdId))
    .where(
      and(eq(meals.id, mealId), eq(meals.householdId, householdId), isNull(meals.archivedAt))
    )
    .limit(1);

  if (!mealRow) {
    return { ok: false, code: "AI_ERROR", message: "Meal not found." };
  }

  if (!mealRow.recipeText?.trim()) {
    return { ok: false, code: "RECIPE_MISSING", message: "This meal doesn't have a recipe saved yet." };
  }

  const latestLog = await db.query.mealLogs.findFirst({
    where: and(eq(mealLogs.mealId, mealId), eq(mealLogs.householdId, householdId), isNull(mealLogs.deletedAt)),
    orderBy: desc(mealLogs.cookedAt)
  });

  try {
    const { text } = await withFallback(
      () =>
        openai.generateShareText(
          mealRow.name,
          mealRow.recipeText!,
          latestLog?.notes,
          mealRow.householdName
        ),
      () =>
        anthropic.generateShareText(
          mealRow.name,
          mealRow.recipeText!,
          latestLog?.notes,
          mealRow.householdName
        ),
      { operation: "generate_share_text" }
    );
    return { ok: true, text };
  } catch {
    return { ok: false, code: "AI_ERROR", message: "AI did not generate a recipe. Try again." };
  }
}
