"use server";

import { requireCurrentUser } from "@/lib/auth/session";
import { checkAiCallLimit } from "@/lib/security/rate-limit";
import { generateShareableRecipe, suggestMealFromImage, suggestMealFromText } from "@/services/ai";
import type { MealSuggestion, ShareActionResult } from "@/types";

export async function suggestFromImageAction(formData: FormData): Promise<MealSuggestion> {
  const user = await requireCurrentUser();
  await checkAiCallLimit(user.id);

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please select an image file.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return suggestMealFromImage(base64, file.type);
}

export async function suggestFromTextAction(text: string): Promise<MealSuggestion> {
  const user = await requireCurrentUser();
  await checkAiCallLimit(user.id);

  return suggestMealFromText(text);
}

export async function generateShareAction(mealId: string): Promise<ShareActionResult> {
  const user = await requireCurrentUser();

  try {
    await checkAiCallLimit(user.id);
  } catch {
    return { ok: false, code: "RATE_LIMITED", message: "You've hit your daily AI limit. Try again tomorrow." };
  }

  try {
    return await generateShareableRecipe(mealId, user.id);
  } catch {
    return { ok: false, code: "AI_ERROR", message: "Something went wrong. Please try again." };
  }
}
