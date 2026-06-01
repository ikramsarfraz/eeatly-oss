import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { withFallback } from "@/lib/ai/providers";
import * as anthropic from "@/lib/ai/providers/anthropic";
import * as openai from "@/lib/ai/providers/openai";
import { households, mealLogs, meals } from "@/db/schema";
import { generateDishImageForName } from "@/services/dish-images";
import { canEditItem, getGrantRole } from "@/services/sharing";
import { mealVisibilityFilter } from "@/lib/meals/visibility";
import { requireHouseholdMember } from "@/lib/auth/session";
import {
  AudioInvalidFormatError,
  AudioTooLargeError,
  AudioTooShortOrEmptyError,
  AudioTranscriptionFailedError
} from "@/lib/errors/audio";
import { NoRecipeTextError } from "@/lib/errors/ingredients";
import { requireFeatureAccess } from "@/lib/gates/resolver";
import type { MeasurementSystem } from "@/lib/units/detect";
import {
  isSupportedAudioMediaType,
  MAX_AUDIO_UPLOAD_BYTES
} from "@eeatly/api/validators/ai";
import { logger } from "@/lib/observability/logger";
import type { MealSuggestion, ShareActionResult } from "@/types";

const SUPPORTED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;

export async function suggestMealFromImage(
  imageBase64: string,
  mediaType: string,
  system: MeasurementSystem = "metric"
): Promise<MealSuggestion> {
  if (!(SUPPORTED_MEDIA_TYPES as readonly string[]).includes(mediaType)) {
    throw new Error(
      `Unsupported image type: ${mediaType}. Please use JPEG, PNG, GIF, or WebP.`
    );
  }

  return withFallback(
    () => openai.suggestMealFromImage(imageBase64, mediaType, system),
    () => anthropic.suggestMealFromImage(imageBase64, mediaType, system),
    { operation: "suggest_meal_from_image" }
  );
}

export async function suggestMealFromText(
  text: string,
  system: MeasurementSystem = "metric"
): Promise<MealSuggestion> {
  if (!text.trim()) {
    throw new Error("Please paste some text before requesting a suggestion.");
  }

  return withFallback(
    () => openai.suggestMealFromText(text, system),
    () => anthropic.suggestMealFromText(text, system),
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
  // Round 6 feature gate. Beta cohorts pass through; non-beta non-paid
  // users get a typed `FeatureGateDeniedError`, which the action layer
  // translates to `{ ok: false, code: 'UPGRADE_REQUIRED' }`.
  await requireFeatureAccess(userId, "ai_share_recipe");

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

/**
 * Round 10 — extract ingredients on demand for a meal that already
 * has a `recipeText` saved but no `ingredients` array (legacy meals
 * from before Round 10, or AI sources that didn't surface ingredients
 * the first time around). Persists the result back to `meals.ingredients`.
 *
 * Authz layers, in order:
 *   1. `requireHouseholdMember` — only members can extract for their
 *      household's meals. Throws "Not authorized" for cross-household.
 *   2. `requireFeatureAccess('ai_suggest_text')` — same gate the
 *      paste-text flow uses. Beta cohorts pass, free non-beta users
 *      get FeatureGateDeniedError. Rate limiting is the action layer's
 *      responsibility (same as the other suggest flows).
 *
 * Re-running on a meal that already has ingredients overwrites them.
 * v1 ships this without a confirmation: keeping the action surface
 * single-shot. If the user complains about lost edits, add a confirm
 * step in the UI rather than complicating the action contract.
 */
export async function extractIngredientsForMeal(args: {
  userId: string;
  householdId: string;
  mealId: string;
}): Promise<string[]> {
  await requireFeatureAccess(args.userId, "ai_suggest_text");

  // Write path (overwrites meal.ingredients): editable by the owner and
  // anyone granted edit/admin. We surface every non-editable case — missing,
  // archived, no access — as the same NoRecipeTextError so nothing leaks.
  const [mealRow] = await db
    .select({
      id: meals.id,
      recipeText: meals.recipeText,
      createdByUserId: meals.createdByUserId
    })
    .from(meals)
    .where(and(eq(meals.id, args.mealId), isNull(meals.archivedAt)))
    .limit(1);

  if (!mealRow) {
    throw new NoRecipeTextError();
  }
  // Editable by owner + edit/admin grantees. We have the creator from the
  // row, so resolve the grant role directly (one extra query for non-owners).
  const role =
    mealRow.createdByUserId === args.userId
      ? "owner"
      : await getGrantRole(args.userId, "recipe", args.mealId);
  if (!canEditItem(role)) {
    throw new NoRecipeTextError();
  }

  const recipeText = mealRow.recipeText?.trim();
  if (!recipeText) {
    throw new NoRecipeTextError();
  }

  const ingredients = await withFallback(
    () => openai.extractIngredientsFromText(recipeText),
    () => anthropic.extractIngredientsFromText(recipeText),
    { operation: "extract_ingredients_from_text" }
  );

  // Coerce to the same shape createMealLog persists: drop empties,
  // null out when the model returned nothing usable. Persisting `[]`
  // would semantically claim "the AI saw zero ingredients," which is
  // a real outcome — but the UI empty state treats null and `[]` the
  // same, so we collapse to null to keep the row cleaner.
  const cleaned = ingredients
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  await db
    .update(meals)
    .set({
      ingredients: cleaned.length > 0 ? cleaned : null,
      updatedAt: new Date()
    })
    .where(eq(meals.id, args.mealId));

  return cleaned;
}

/**
 * Resolve (and, on first request, generate) the app-wide AI image for a
 * meal that has no photo of its own.
 *
 * Authz: `requireHouseholdMember` + the same visibility predicate the
 * recipe view uses, so a member can only trigger generation for a meal
 * they're actually allowed to see. If the meal already carries its own
 * `photoUrl`, we return that and never spend an OpenAI call.
 *
 * The heavy lifting (cache check, OpenAI, R2 upload, persist) lives in
 * `services/dish-images.ts`; this wrapper just supplies meal context +
 * auth. Returns `{ imageUrl: string | null }` — null when generation is
 * unavailable or fails, in which case the UI keeps the monogram tile.
 */
export async function generateDishImageForMeal(args: {
  userId: string;
  householdId: string;
  mealId: string;
}): Promise<{ imageUrl: string | null }> {
  await requireHouseholdMember(args.userId, args.householdId);

  const [mealRow] = await db
    .select({
      name: meals.name,
      photoUrl: meals.photoUrl
    })
    .from(meals)
    .where(
      and(
        eq(meals.id, args.mealId),
        eq(meals.householdId, args.householdId),
        isNull(meals.archivedAt),
        mealVisibilityFilter(args.userId, args.householdId)
      )
    )
    .limit(1);

  // Missing / archived / not-visible all collapse to "no image" — the
  // recipe page already 404s these, so we don't leak why.
  if (!mealRow) return { imageUrl: null };

  // A user's own photo always wins; never spend a generation on it.
  if (mealRow.photoUrl) return { imageUrl: mealRow.photoUrl };

  const imageUrl = await generateDishImageForName(mealRow.name);
  return { imageUrl };
}

// Round 8 — voice notes.

// Voice-note transcripts shorter than this almost never produce a real
// recipe — usually it's mic test ("hello? hello?") or a fragment
// captured by accident. We bail with a typed error so the UI can ask
// for a longer recording rather than burning a provider call.
const MIN_TRANSCRIPT_CHARS = 30;

/**
 * Round 8 — transcriber boundary. The default `whisperTranscriber`
 * wraps the OpenAI Whisper SDK call; tests inject a stub. Mirrors
 * the `TranscriptFetcher` pattern from the YouTube path so the
 * service stays library-agnostic and unit-testable.
 */
export interface AudioTranscriber {
  transcribe(audioBuffer: Buffer, mediaType: string, fileName: string): Promise<string>;
}

export const whisperTranscriber: AudioTranscriber = {
  transcribe: (audioBuffer, mediaType, fileName) =>
    openai.transcribeAudio(audioBuffer, mediaType, fileName)
};

/**
 * Round 8 — extract a meal suggestion from a voice note. Pipeline:
 *   1. Gate check (`ai_suggest_voice`)
 *   2. Validate mediaType + size (typed errors before any provider call)
 *   3. Whisper transcription (no Anthropic fallback — see lib/errors/audio.ts)
 *   4. Validate transcript length (typed error if too short/empty)
 *   5. AI extraction via the OpenAI → Anthropic fallback chain
 *
 * No audio persistence. The buffer lives only inside this call's
 * stack frame — Whisper returns text, the recipe is extracted, and
 * the audio bytes are eligible for GC the moment the function returns.
 */
export async function suggestMealFromAudio(
  args: {
    audioBuffer: Buffer;
    mediaType: string;
    fileName?: string;
    userId: string;
    system?: MeasurementSystem;
  },
  deps: { transcriber?: AudioTranscriber } = {}
): Promise<MealSuggestion> {
  await requireFeatureAccess(args.userId, "ai_suggest_voice");

  if (!isSupportedAudioMediaType(args.mediaType)) {
    throw new AudioInvalidFormatError(args.mediaType);
  }
  if (args.audioBuffer.byteLength > MAX_AUDIO_UPLOAD_BYTES) {
    throw new AudioTooLargeError();
  }
  if (args.audioBuffer.byteLength === 0) {
    throw new AudioTooShortOrEmptyError();
  }

  const transcriber = deps.transcriber ?? whisperTranscriber;
  // Whisper's required `filename` is used for format detection — pass
  // a sensible default with the right extension if the caller didn't
  // provide one. Most uploads carry the original filename through.
  const fileName = args.fileName ?? defaultFileNameFor(args.mediaType);

  let transcript: string;
  try {
    transcript = await transcriber.transcribe(args.audioBuffer, args.mediaType, fileName);
  } catch (error) {
    logger.warn("ai_audio_transcription_failed", {
      userId: args.userId,
      mediaType: args.mediaType,
      bytes: args.audioBuffer.byteLength,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new AudioTranscriptionFailedError();
  }

  const trimmed = transcript.trim();
  if (trimmed.length < MIN_TRANSCRIPT_CHARS) {
    throw new AudioTooShortOrEmptyError();
  }

  const system = args.system ?? "metric";
  return withFallback(
    () => openai.suggestMealFromVoiceTranscript(trimmed, system),
    () => anthropic.suggestMealFromVoiceTranscript(trimmed, system),
    { operation: "suggest_meal_from_voice" }
  );
}

function defaultFileNameFor(mediaType: string): string {
  // Whisper uses the file extension when the MIME type is ambiguous,
  // so we map our supported set to canonical extensions. Unknown types
  // would already have been rejected by `isSupportedAudioMediaType`.
  const extByType: Record<string, string> = {
    "audio/mpeg": "audio.mp3",
    "audio/mp3": "audio.mp3",
    "audio/mp4": "audio.mp4",
    "audio/m4a": "audio.m4a",
    "audio/x-m4a": "audio.m4a",
    "audio/ogg": "audio.ogg",
    "audio/opus": "audio.opus",
    "audio/wav": "audio.wav",
    "audio/x-wav": "audio.wav",
    "audio/webm": "audio.webm",
    "audio/flac": "audio.flac"
  };
  return extByType[mediaType] ?? "audio.bin";
}

