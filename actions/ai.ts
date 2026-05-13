"use server";

import { requireCurrentUser, requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";
import { checkAiCallLimit } from "@/lib/security/rate-limit";
import { generateShareableRecipe, suggestMealFromImage, suggestMealFromText } from "@/services/ai";
import type { MealSuggestion, ShareActionResult } from "@/types";

// Match the 10 MB cap enforced server-side by R2 presigned-post conditions.
// Without this, a malicious upload could buffer arbitrary bytes into RAM
// (and 1.33× more after base64 encoding) before any provider call.
const MAX_IMAGE_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * Round 4.7: discriminated-union return matching the Round 4 action pattern.
 *   - `INVALID_INPUT`: client-side mistake (missing file, empty text, file
 *     too big, unsupported media type). UI surfaces the action's message.
 *   - `RATE_LIMITED`: AI call budget exceeded. UI shows a generic
 *     "try again tomorrow" toast.
 *   - `AI_PROVIDER_ERROR`: provider chain failed (both OpenAI and
 *     Anthropic). UI shows a generic "try again" toast; we don't leak
 *     provider error details to users.
 */
export type SuggestResult =
  | { ok: true; data: MealSuggestion }
  | {
      ok: false;
      code: "INVALID_INPUT" | "RATE_LIMITED" | "AI_PROVIDER_ERROR";
      message?: string;
    };

export async function suggestFromImageAction(formData: FormData): Promise<SuggestResult> {
  const user = await requireCurrentUser();

  try {
    await checkAiCallLimit(user.id);
  } catch {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "You've hit your daily AI limit. Try again tomorrow."
    };
  }

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, code: "INVALID_INPUT", message: "Please select an image file." };
  }

  if (file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Image is too large. Please use a photo under 10 MB."
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  try {
    const suggestion = await suggestMealFromImage(base64, file.type);
    return { ok: true, data: suggestion };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown provider error.";
    // Unsupported-media-type rejections come up through the service as a
    // typed Error; surface them as INVALID_INPUT so the UI distinguishes
    // "user mistake" (retry helps) from "provider down" (retry doesn't).
    if (message.toLowerCase().includes("unsupported image type")) {
      return { ok: false, code: "INVALID_INPUT", message };
    }
    logger.warn("ai_suggest_from_image_failed", { userId: user.id, error: message });
    return {
      ok: false,
      code: "AI_PROVIDER_ERROR",
      message: "We couldn't read that photo. Please try again."
    };
  }
}

export async function suggestFromTextAction(text: string): Promise<SuggestResult> {
  const user = await requireCurrentUser();

  try {
    await checkAiCallLimit(user.id);
  } catch {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "You've hit your daily AI limit. Try again tomorrow."
    };
  }

  if (!text.trim()) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Please paste some text before requesting a suggestion."
    };
  }

  try {
    const suggestion = await suggestMealFromText(text);
    return { ok: true, data: suggestion };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown provider error.";
    logger.warn("ai_suggest_from_text_failed", { userId: user.id, error: message });
    return {
      ok: false,
      code: "AI_PROVIDER_ERROR",
      message: "We couldn't read that. Please try again."
    };
  }
}

export async function generateShareAction(mealId: string): Promise<ShareActionResult> {
  const { user, household } = await requireCurrentUserWithHousehold();

  try {
    await checkAiCallLimit(user.id);
  } catch {
    return { ok: false, code: "RATE_LIMITED", message: "You've hit your daily AI limit. Try again tomorrow." };
  }

  try {
    return await generateShareableRecipe(user.id, household.id, mealId);
  } catch {
    return { ok: false, code: "AI_ERROR", message: "Something went wrong. Please try again." };
  }
}
