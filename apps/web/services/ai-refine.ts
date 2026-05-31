import "server-only";

import { withFallback } from "@/lib/ai/providers";
import * as anthropic from "@/lib/ai/providers/anthropic";
import * as openai from "@/lib/ai/providers/openai";
import {
  AudioInvalidFormatError,
  AudioTooLargeError,
  AudioTooShortOrEmptyError,
  AudioTranscriptionFailedError
} from "@/lib/errors/audio";
import { requireFeatureAccess } from "@/lib/gates/resolver";
import {
  isSupportedAudioMediaType,
  MAX_AUDIO_UPLOAD_BYTES
} from "@eeatly/api/validators/ai";
import type { ProposeChangesResponse } from "@eeatly/api/validators/refine";
import { logger } from "@/lib/observability/logger";
import {
  whisperTranscriber,
  type AudioTranscriber
} from "@/services/ai";

/**
 * Round 18 — AI service for the Refine recipe flow.
 *
 * Three entry points, one per input mode:
 *   - `proposeChangesFromText` — user text or example chip
 *   - `proposeChangesFromVoice` — Whisper-first, then text proposal
 *   - `proposeChangesFromPhoto` — vision-capable model, recipe + image
 *
 * Unlike `services/ai.ts:suggestMealFromX` (which extracts a meal from
 * raw input), this service diffs against an existing recipe. The
 * model is given the current recipe + the user's instruction and is
 * asked to emit a structured `PendingChange[]`. Schema is validated
 * with Zod at the provider boundary, so a malformed response throws
 * before the caller sees it.
 *
 * Provider fallback follows the R7 pattern: OpenAI primary, Anthropic
 * secondary, both wrapped in `withFallback`. Whisper is unchanged — it
 * remains the sole transcriber.
 *
 * Audio + photo bytes are passed through to the provider directly; the
 * tRPC layer is responsible for persisting them to R2 ahead of this
 * call when the attachment needs to survive the request.
 */

/**
 * Compact representation of a recipe that the model can read. Includes
 * just enough metadata for the model to diff intelligently — ids
 * (so it can reference rows), names + bodies (so it knows the content),
 * effort + step count (so heads-up rules can be aware).
 */
export type RecipeContext = {
  id: string;
  name: string;
  effortLevel: "quick" | "easy" | "medium" | "high_effort" | null;
  /**
   * Legacy free-form recipe text, when the meal has no structured rows.
   * Lets the model convert a prose recipe (or an empty meal) into
   * structured ingredients/steps via "add" changes. Optional so existing
   * fixtures/callers don't have to thread it; the loader always sets it.
   */
  recipeText?: string | null;
  ingredients: Array<{
    id: string;
    position: number;
    name: string;
    quantityString: string;
    prepNote: string | null;
  }>;
  steps: Array<{
    id: string;
    position: number;
    title: string;
    time: string | null;
    body: string;
    ingredientIds: string[];
  }>;
};

function serialiseRecipe(recipe: RecipeContext): string {
  return JSON.stringify(recipe);
}

export async function proposeChangesFromText(args: {
  userId: string;
  recipe: RecipeContext;
  prompt: string;
}): Promise<ProposeChangesResponse> {
  await requireFeatureAccess(args.userId, "ai_suggest_text");
  const recipeJson = serialiseRecipe(args.recipe);
  return withFallback(
    () =>
      openai.proposeRefineChanges({
        recipeJson,
        instruction: args.prompt
      }),
    () =>
      anthropic.proposeRefineChanges({
        recipeJson,
        instruction: args.prompt
      }),
    { operation: "refine_propose_changes_text" }
  );
}

const MIN_TRANSCRIPT_CHARS = 4;

export async function proposeChangesFromVoice(
  args: {
    userId: string;
    recipe: RecipeContext;
    audioBuffer: Buffer;
    mediaType: string;
    fileName?: string;
  },
  deps: { transcriber?: AudioTranscriber } = {}
): Promise<ProposeChangesResponse & { transcript: string }> {
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
  const fileName = args.fileName ?? defaultFileNameFor(args.mediaType);

  let transcript: string;
  try {
    transcript = await transcriber.transcribe(
      args.audioBuffer,
      args.mediaType,
      fileName
    );
  } catch (error) {
    logger.warn("refine_voice_transcription_failed", {
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

  const recipeJson = serialiseRecipe(args.recipe);
  const proposed = await withFallback(
    () =>
      openai.proposeRefineChanges({
        recipeJson,
        instruction: trimmed
      }),
    () =>
      anthropic.proposeRefineChanges({
        recipeJson,
        instruction: trimmed
      }),
    { operation: "refine_propose_changes_voice" }
  );

  return { ...proposed, transcript: trimmed };
}

export async function proposeChangesFromPhoto(args: {
  userId: string;
  recipe: RecipeContext;
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
}): Promise<ProposeChangesResponse> {
  await requireFeatureAccess(args.userId, "ai_suggest_image");

  const recipeJson = serialiseRecipe(args.recipe);
  // Photo mode's "prompt" is the photo itself + a fixed instruction so
  // the model knows to interpret the image as a diff rather than as a
  // standalone recipe extraction.
  const instruction =
    "The attached photo describes a change to apply to this recipe — a handwritten correction, a sticky note, a marked cookbook page, or a circled ingredient. Emit a PendingChange[] diff that applies the change.";
  return withFallback(
    () =>
      openai.proposeRefineChanges({
        recipeJson,
        instruction,
        image: { base64: args.imageBase64, mediaType: args.mediaType }
      }),
    () =>
      anthropic.proposeRefineChanges({
        recipeJson,
        instruction,
        image: { base64: args.imageBase64, mediaType: args.mediaType }
      }),
    { operation: "refine_propose_changes_photo" }
  );
}

function defaultFileNameFor(mediaType: string): string {
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
