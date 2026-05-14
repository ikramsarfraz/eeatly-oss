import "server-only";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { withFallback } from "@/lib/ai/providers";
import * as anthropic from "@/lib/ai/providers/anthropic";
import * as openai from "@/lib/ai/providers/openai";
import { households, mealLogs, meals } from "@/db/schema";
import { requireHouseholdMember } from "@/lib/auth/session";
import {
  YoutubePlaylistUnsupportedError,
  YoutubeShortsUnsupportedError
} from "@/lib/errors/youtube";
import { requireFeatureAccess } from "@/lib/gates/resolver";
import {
  youtubeTranscriptFetcher,
  type TranscriptFetcher
} from "@/lib/ai/youtube-transcript";
import { classifyYoutubeUrl } from "@/lib/validators/ai";
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

// Round 7 — YouTube transcript extraction.

// Token-budget heuristic. Transcripts longer than this get the
// "first 70% + last 20%" treatment — recipes usually open with
// ingredients/intro and close with serving notes; the middle is
// the cook talking through technique, which we sample less of.
// Picked empirically based on the 4o-mini context budget after the
// prompt + JSON schema overhead.
const TRANSCRIPT_TOKEN_BUDGET_CHARS = 50_000;

/**
 * Round 7 — extract a meal suggestion from a YouTube cooking video.
 * Pure orchestration:
 *   1. Gate check (`ai_suggest_youtube`)
 *   2. URL classification — Shorts / playlist / invalid get typed errors
 *   3. Transcript fetch via the swappable `TranscriptFetcher`
 *   4. Smart truncation if the transcript exceeds the token budget
 *   5. AI extraction via the existing OpenAI → Anthropic fallback
 *
 * The `fetcher` parameter is injected for tests; callers in production
 * default to `youtubeTranscriptFetcher` (the `youtube-transcript`
 * library impl). Swapping libraries is a one-line change in
 * `lib/ai/youtube-transcript.ts`.
 */
export async function suggestMealFromYouTubeUrl(
  args: {
    userId: string;
    url: string;
  },
  deps: { fetcher?: TranscriptFetcher } = {}
): Promise<MealSuggestion> {
  await requireFeatureAccess(args.userId, "ai_suggest_youtube");

  const classification = classifyYoutubeUrl(args.url);
  if (classification.kind === "shorts") {
    throw new YoutubeShortsUnsupportedError();
  }
  if (classification.kind === "playlist") {
    throw new YoutubePlaylistUnsupportedError();
  }
  if (classification.kind === "invalid") {
    throw new Error("Not a YouTube URL.");
  }

  const fetcher = deps.fetcher ?? youtubeTranscriptFetcher;
  const segments = await fetcher.fetch(classification.normalizedUrl);
  const transcriptText = segmentsToTranscriptText(segments);
  const truncated = truncateForBudget(transcriptText);

  return withFallback(
    () => openai.suggestMealFromTranscript(truncated),
    () => anthropic.suggestMealFromTranscript(truncated),
    { operation: "suggest_meal_from_youtube" }
  );
}

function segmentsToTranscriptText(
  segments: { text: string }[]
): string {
  // Library returns segments with timing — for AI extraction we only
  // care about the text. Spaces between segments because the library
  // doesn't include trailing whitespace.
  return segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Truncation: 70% from the head, 20% from the tail. Cooking videos
 * typically front-load the recipe and tail-load serving / variation
 * notes; the middle is technique discussion that's the most
 * compressible. The seam between head and tail is marked so the model
 * doesn't try to bridge the missing middle as if it were contiguous.
 *
 * Exported for tests; not exposed via the public surface.
 */
export function truncateForBudget(transcript: string): string {
  if (transcript.length <= TRANSCRIPT_TOKEN_BUDGET_CHARS) return transcript;

  const headLen = Math.floor(TRANSCRIPT_TOKEN_BUDGET_CHARS * 0.7);
  const tailLen = Math.floor(TRANSCRIPT_TOKEN_BUDGET_CHARS * 0.2);
  const head = transcript.slice(0, headLen);
  const tail = transcript.slice(-tailLen);
  return `${head}\n\n[…transcript middle omitted; ${
    transcript.length - headLen - tailLen
  } characters skipped…]\n\n${tail}`;
}
