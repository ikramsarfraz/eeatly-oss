"use server";

import { requireCurrentUser, requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { checkAiCallLimit } from "@/lib/security/rate-limit";
import { generateShareableRecipe, suggestMealFromImage, suggestMealFromText } from "@/services/ai";
import type { MealSuggestion, ShareActionResult } from "@/types";

// Match the 10 MB cap enforced server-side by R2 presigned-post conditions.
// Without this, a malicious upload could buffer arbitrary bytes into RAM
// (and 1.33× more after base64 encoding) before any provider call.
const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function suggestFromImageAction(formData: FormData): Promise<MealSuggestion> {
  const user = await requireCurrentUser();
  await checkAiCallLimit(user.id);

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Please select an image file.");
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error("Image is too large. Please use a photo under 10 MB.");
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
  const { user, household } = await requireCurrentUserWithHousehold();

  try {
    await checkAiCallLimit(user.id);
  } catch {
    return { ok: false, code: "RATE_LIMITED", message: "You've hit your daily AI limit. Try again tomorrow." };
  }

  try {
    return await generateShareableRecipe(mealId, household.id);
  } catch {
    return { ok: false, code: "AI_ERROR", message: "Something went wrong. Please try again." };
  }
}
