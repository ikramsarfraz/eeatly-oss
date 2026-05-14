"use server";

import { requireCurrentUser, requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { FeatureGateDeniedError } from "@/lib/errors/gates";
import {
  YoutubeAgeRestrictedError,
  YoutubeFetchFailedError,
  YoutubeNoTranscriptError,
  YoutubePlaylistUnsupportedError,
  YoutubeShortsUnsupportedError,
  YoutubeUnavailableError
} from "@/lib/errors/youtube";
import type { FeatureKey } from "@/lib/gates/registry";
import { requireFeatureAccess } from "@/lib/gates/resolver";
import { logger } from "@/lib/observability/logger";
import { checkAiCallLimit } from "@/lib/security/rate-limit";
import {
  generateShareableRecipe,
  suggestMealFromImage,
  suggestMealFromText,
  suggestMealFromYouTubeUrl
} from "@/services/ai";
import { youtubeUrlSchema, type YoutubeUrlInput } from "@/lib/validators/ai";
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
      code: "INVALID_INPUT" | "RATE_LIMITED" | "AI_PROVIDER_ERROR" | "UPGRADE_REQUIRED";
      message?: string;
      /** Present when code === "UPGRADE_REQUIRED". UI keys upgrade-prompt
       *  copy off this. */
      feature?: FeatureKey;
    };

export async function suggestFromImageAction(formData: FormData): Promise<SuggestResult> {
  const user = await requireCurrentUser();

  // Gate first — don't burn a rate-limit slot for a user who can't reach
  // the feature anyway. FeatureGateDeniedError is the typed error; map
  // to the UPGRADE_REQUIRED code so the UI can render the upgrade card.
  try {
    await requireFeatureAccess(user.id, "ai_suggest_image");
  } catch (error) {
    if (error instanceof FeatureGateDeniedError) {
      return {
        ok: false,
        code: "UPGRADE_REQUIRED",
        feature: error.feature
      };
    }
    throw error;
  }

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
    await requireFeatureAccess(user.id, "ai_suggest_text");
  } catch (error) {
    if (error instanceof FeatureGateDeniedError) {
      return { ok: false, code: "UPGRADE_REQUIRED", feature: error.feature };
    }
    throw error;
  }

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
  } catch (error) {
    // Gate-denied is service-thrown — translate to UPGRADE_REQUIRED so
    // the UI can render the upgrade prompt instead of a generic error.
    if (error instanceof FeatureGateDeniedError) {
      return {
        ok: false,
        code: "UPGRADE_REQUIRED",
        message: error.message,
        feature: error.feature
      };
    }
    return { ok: false, code: "AI_ERROR", message: "Something went wrong. Please try again." };
  }
}

/**
 * Round 7 — YouTube transcript extraction. Discriminated union has
 * its own codes (separate from `SuggestResult`) because the YouTube
 * surface has six distinct failure modes the UI should distinguish:
 * Shorts / playlist / no transcript / unavailable / age-restricted /
 * fetch failed. Trying to merge these into `SuggestResult` would
 * pollute the photo + text paths with codes they can never return.
 *
 * Success payload is the same `MealSuggestion` shape — the dialog's
 * `onSuggestion` callback doesn't care which path produced it.
 */
export type YouTubeSuggestResult =
  | { ok: true; data: MealSuggestion }
  | {
      ok: false;
      code:
        | "INVALID_INPUT"
        | "RATE_LIMITED"
        | "UPGRADE_REQUIRED"
        | "YOUTUBE_NO_TRANSCRIPT"
        | "YOUTUBE_SHORTS_UNSUPPORTED"
        | "YOUTUBE_PLAYLIST_UNSUPPORTED"
        | "YOUTUBE_UNAVAILABLE"
        | "YOUTUBE_AGE_RESTRICTED"
        | "YOUTUBE_FETCH_FAILED"
        | "AI_PROVIDER_ERROR";
      message?: string;
      feature?: FeatureKey;
    };

export async function suggestFromYouTubeAction(
  input: YoutubeUrlInput
): Promise<YouTubeSuggestResult> {
  const parsed = youtubeUrlSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: parsed.error.issues[0]?.message ?? "Paste a YouTube URL."
    };
  }

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

  try {
    const suggestion = await suggestMealFromYouTubeUrl({
      userId: user.id,
      url: parsed.data.url
    });
    return { ok: true, data: suggestion };
  } catch (error) {
    if (error instanceof FeatureGateDeniedError) {
      return {
        ok: false,
        code: "UPGRADE_REQUIRED",
        message: error.message,
        feature: error.feature
      };
    }
    // Each YouTube typed error maps to its own code so the UI shows
    // the right message. instanceof chain runs in specific-first order;
    // none subclass each other so order is just for readability.
    if (error instanceof YoutubeShortsUnsupportedError) {
      return { ok: false, code: "YOUTUBE_SHORTS_UNSUPPORTED", message: error.message };
    }
    if (error instanceof YoutubePlaylistUnsupportedError) {
      return { ok: false, code: "YOUTUBE_PLAYLIST_UNSUPPORTED", message: error.message };
    }
    if (error instanceof YoutubeNoTranscriptError) {
      return { ok: false, code: "YOUTUBE_NO_TRANSCRIPT", message: error.message };
    }
    if (error instanceof YoutubeAgeRestrictedError) {
      return { ok: false, code: "YOUTUBE_AGE_RESTRICTED", message: error.message };
    }
    if (error instanceof YoutubeUnavailableError) {
      return { ok: false, code: "YOUTUBE_UNAVAILABLE", message: error.message };
    }
    if (error instanceof YoutubeFetchFailedError) {
      return { ok: false, code: "YOUTUBE_FETCH_FAILED", message: error.message };
    }
    // Service threw "Not a YouTube URL." — schema validation upstream
    // catches the common cases; this is the fallback when the schema
    // missed something.
    const message = error instanceof Error ? error.message : "Unknown error.";
    if (message.includes("Not a YouTube URL")) {
      return {
        ok: false,
        code: "INVALID_INPUT",
        message: "That doesn't look like a YouTube link."
      };
    }
    logger.warn("ai_suggest_from_youtube_failed", { userId: user.id, error: message });
    return {
      ok: false,
      code: "AI_PROVIDER_ERROR",
      message: "We couldn't read that video. Please try again."
    };
  }
}
