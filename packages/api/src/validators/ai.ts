import { z } from "zod";

/**
 * Round 8 — voice notes. Validates the audio's MIME type + size before
 * the service hits Whisper. The set mirrors Whisper's accepted formats
 * (mp3/mp4/m4a/mpeg/mpga/ogg/opus/wav/webm/flac); we accept the same
 * with both `audio/mp3` and `audio/mpeg` because browsers disagree on
 * the canonical MIME (Chrome on macOS reports `audio/mp3` for `.mp3`).
 *
 * `audio/m4a` is a non-standard but real-world MIME that some iOS
 * exports use; included so WhatsApp voice-note uploads on iOS don't
 * get rejected at the validator.
 */
export const SUPPORTED_AUDIO_MEDIA_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/ogg",
  "audio/opus",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/flac"
] as const;

export type SupportedAudioMediaType = (typeof SUPPORTED_AUDIO_MEDIA_TYPES)[number];

export const MAX_AUDIO_UPLOAD_BYTES = 25 * 1024 * 1024;

export function isSupportedAudioMediaType(value: string): value is SupportedAudioMediaType {
  return (SUPPORTED_AUDIO_MEDIA_TYPES as readonly string[]).includes(value);
}

export const audioInputSchema = z.object({
  mediaType: z
    .string()
    .min(1, "Missing audio mediaType.")
    .refine(isSupportedAudioMediaType, {
      message: "Unsupported audio format."
    }),
  size: z
    .number()
    .int()
    .positive("Audio file is empty.")
    .max(MAX_AUDIO_UPLOAD_BYTES, "Audio file exceeds the 25 MB limit.")
});

export type AudioInput = z.infer<typeof audioInputSchema>;

/**
 * Round 10 — canonical shape for an AI-extracted meal suggestion.
 *
 * `ingredients` is OPTIONAL on purpose: older provider responses (and
 * any cached test fixtures) predate the field, so a missing key must
 * still parse cleanly. The provider-layer parseSuggestion helpers
 * coerce to `[]` when absent so the type-level contract (`string[]`)
 * stays honest downstream.
 */
export const mealSuggestionSchema = z.object({
  name: z.string(),
  effortGuess: z.enum(["quick", "easy", "medium", "high_effort"]),
  notes: z.string(),
  recipeText: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  ingredients: z.array(z.string()).optional()
});

export type MealSuggestionInput = z.infer<typeof mealSuggestionSchema>;

/**
 * Round 16 — URL preview input. Accepts any URL string; the procedure
 * does the heavy validation (scheme, SSRF defense, host resolution).
 * Kept loose here so we can return typed errors (`URL_INVALID`,
 * `URL_PRIVATE_NETWORK`) with platform-specific copy instead of generic
 * Zod refinement errors.
 */
export const urlPreviewInputSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Paste a URL.")
    .max(2048, "URL is too long.")
});

export type UrlPreviewInput = z.infer<typeof urlPreviewInputSchema>;
