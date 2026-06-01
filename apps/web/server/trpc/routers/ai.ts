import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  AudioInvalidFormatError,
  AudioTooLargeError,
  AudioTooShortOrEmptyError,
  AudioTranscriptionFailedError
} from "@/lib/errors/audio";
import { FeatureGateDeniedError } from "@/lib/errors/gates";
import { NoRecipeTextError } from "@/lib/errors/ingredients";
import { logger } from "@/lib/observability/logger";
import {
  audioInputSchema,
  MAX_AUDIO_UPLOAD_BYTES
} from "@eeatly/api/validators/ai";
import {
  extractIngredientsForMeal,
  generateDishImageForMeal,
  generateShareableRecipe,
  suggestMealFromAudio,
  suggestMealFromImage,
  suggestMealFromText
} from "@/services/ai";
import { getUserSettings } from "@/services/user-settings";
import { withAiCredits } from "@/services/ai-credits";
import { InsufficientCreditsError } from "@/lib/errors/credits";
import {
  gatedProcedure,
  householdMemberProcedure,
  protectedProcedure,
  rateLimit,
  router
} from "../trpc";

/**
 * Round 11 — AI procedures.
 *
 * Binary inputs (image bytes for the photo path, audio bytes for the
 * voice path) ride as base64 strings in the JSON body. This preserves
 * the existing behavior — the legacy server actions also base64-encoded
 * server-side before reaching the providers — without forcing a
 * separate R2 round-trip for one-shot AI calls. Per the Round 11 ground
 * rule, "tRPC handles JSON; R2 handles binaries" — for AI suggests the
 * binary IS the input, and ferrying it through R2 + a key would mean
 * orphan uploads when the user doesn't save the meal. Persisted photos
 * still go through the existing presign + R2 path (Round 4 flow,
 * unchanged) — only the AI-temp surface inlines bytes.
 *
 * Wire size: a 10 MB photo → ~13 MB base64 JSON; a 25 MB voice note →
 * ~33 MB. Browser memory + tRPC's batch link both handle this fine for
 * the one-shot user-initiated UX action. Document for posterity in case
 * the future mobile client wants a smaller wire format.
 */

const photoInputSchema = z.object({
  imageBase64: z
    .string()
    .min(1, "Missing image data.")
    // 10 MB raw → ~13.4 MB base64. Add ~10% slack for the encoding
    // overhead so a borderline-10MB file isn't rejected at the wire.
    .max(15 * 1024 * 1024, "Image too large. Use a photo under 10 MB."),
  mediaType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"])
});

const textInputSchema = z.object({
  text: z.string().trim().min(1, "Paste some text first.").max(20_000)
});

const voiceInputSchema = z.object({
  audioBase64: z.string().min(1, "Missing audio data."),
  mediaType: audioInputSchema.shape.mediaType,
  fileName: z.string().max(180).optional()
});

const mealIdInput = z.object({ mealId: z.string().uuid() });

/**
 * Typed errors out of the Whisper service
 * become structured causes the UI matches on.
 */
function mapAudioError(error: unknown): TRPCError | null {
  if (error instanceof AudioTooLargeError) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: { reason: "AUDIO_TOO_LARGE" }
    });
  }
  if (error instanceof AudioInvalidFormatError) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: { reason: "AUDIO_INVALID_FORMAT" }
    });
  }
  if (error instanceof AudioTranscriptionFailedError) {
    return new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
      cause: { reason: "AUDIO_TRANSCRIPTION_FAILED" }
    });
  }
  if (error instanceof AudioTooShortOrEmptyError) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: { reason: "AUDIO_TOO_SHORT_OR_EMPTY" }
    });
  }
  return null;
}

function mapGateError(error: unknown): TRPCError | null {
  if (error instanceof FeatureGateDeniedError) {
    return new TRPCError({
      code: "FORBIDDEN",
      message: error.message,
      cause: { reason: "UPGRADE_REQUIRED", feature: error.feature }
    });
  }
  return null;
}

/** Out-of-credits → a typed cause the UI turns into a "buy credits / upgrade"
 *  prompt. Must be checked before the generic AI_PROVIDER_ERROR fallback. */
function mapCreditError(error: unknown): TRPCError | null {
  if (error instanceof InsufficientCreditsError) {
    return new TRPCError({
      code: "FORBIDDEN",
      message: error.message,
      cause: { reason: "INSUFFICIENT_CREDITS", needed: error.needed, balance: error.balance }
    });
  }
  return null;
}

export const aiRouter = router({
  /**
   * Photo: image bytes flow as base64 in JSON. The procedure passes
   * the base64 + mediaType straight through to the provider chain,
   * mirroring what `suggestFromImageAction` did with multipart →
   * `arrayBuffer().toString('base64')`.
   */
  suggestFromPhoto: gatedProcedure("ai_suggest_image")
    .use(rateLimit("ai"))
    .input(photoInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { measurementSystem } = await getUserSettings(ctx.user.id);
        return await withAiCredits(ctx.user.id, "suggest_image", () =>
          suggestMealFromImage(input.imageBase64, input.mediaType, measurementSystem)
        );
      } catch (error) {
        const credit = mapCreditError(error);
        if (credit) throw credit;
        const message = error instanceof Error ? error.message : "Unknown error.";
        if (message.toLowerCase().includes("unsupported image type")) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message,
            cause: { reason: "INVALID_INPUT" }
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "We couldn't read that photo. Please try again.",
          cause: { reason: "AI_PROVIDER_ERROR" }
        });
      }
    }),

  suggestFromText: gatedProcedure("ai_suggest_text")
    .use(rateLimit("ai"))
    .input(textInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const { measurementSystem } = await getUserSettings(ctx.user.id);
        return await withAiCredits(ctx.user.id, "suggest_text", () =>
          suggestMealFromText(input.text, measurementSystem)
        );
      } catch (error) {
        const credit = mapCreditError(error);
        if (credit) throw credit;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "We couldn't read that. Please try again.",
          cause: { reason: "AI_PROVIDER_ERROR" }
        });
      }
    }),

  /**
   * Voice: audio bytes flow as base64 in JSON. Same trade-off as the
   * photo path. The procedure decodes back to a Buffer, then hands the
   * binary to the existing `suggestMealFromAudio` service which runs
   * Whisper → recipe extraction.
   */
  suggestFromVoice: protectedProcedure
    .use(rateLimit("ai"))
    .input(voiceInputSchema)
    .mutation(async ({ ctx, input }) => {
      // Pre-flight size check before decoding 33 MB of base64 — saves
      // memory when a malicious client sends the wrong shape.
      // Encoded bytes ≈ raw * 4/3, so the raw limit clamps to (limit * 4/3).
      if (input.audioBase64.length > Math.ceil(MAX_AUDIO_UPLOAD_BYTES * 1.4)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Audio file exceeds the 25 MB limit.",
          cause: { reason: "AUDIO_TOO_LARGE" }
        });
      }
      let audioBuffer: Buffer;
      try {
        audioBuffer = Buffer.from(input.audioBase64, "base64");
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Couldn't decode the audio payload.",
          cause: { reason: "INVALID_INPUT" }
        });
      }
      try {
        const { measurementSystem } = await getUserSettings(ctx.user.id);
        return await withAiCredits(ctx.user.id, "suggest_voice", () =>
          suggestMealFromAudio({
            audioBuffer,
            mediaType: input.mediaType,
            fileName: input.fileName,
            userId: ctx.user.id,
            system: measurementSystem
          })
        );
      } catch (error) {
        const mapped = mapCreditError(error) ?? mapGateError(error) ?? mapAudioError(error);
        if (mapped) throw mapped;
        logger.warn("trpc_ai_voice_failed", {
          userId: ctx.user.id,
          error: error instanceof Error ? error.message : String(error)
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "We couldn't read that audio. Please try again.",
          cause: { reason: "AI_PROVIDER_ERROR" }
        });
      }
    }),

  /**
   * Resolve the app-wide AI image for a meal with no photo of its own.
   * Cache-first in the service: the first viewer of a never-seen dish
   * pays for the OpenAI + R2 round-trip, everyone after reuses the URL.
   *
   * Open to all users (no feature gate) — images are generated once per
   * dish app-wide and shared across households, so free users benefit and
   * the cost ceiling is the distinct-dish count. The `ai` rate-limit
   * bucket (20/day) is the only abuse guard. The trigger is the recipe
   * view firing this once on mount when `photoUrl` is null. Returns
   * `{ imageUrl: null }` (UI keeps the monogram) when generation is
   * unavailable or fails rather than surfacing an error.
   */
  generateDishImage: householdMemberProcedure
    .use(rateLimit("ai"))
    .input(mealIdInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await generateDishImageForMeal({
          userId: ctx.user.id,
          householdId: ctx.household.id,
          mealId: input.mealId
        });
      } catch (error) {
        logger.warn("trpc_ai_dish_image_failed", {
          userId: ctx.user.id,
          mealId: input.mealId,
          error: error instanceof Error ? error.message : String(error)
        });
        // Non-fatal: the recipe view degrades to the monogram tile.
        return { imageUrl: null };
      }
    }),

  /**
   * Round 10 — re-extract ingredients from a meal's saved recipe text.
   * Household-scoped; uses the `ai_suggest_text` gate + AI rate-limit.
   */
  extractIngredientsForMeal: householdMemberProcedure
    .use(rateLimit("ai"))
    .input(mealIdInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const ingredients = await withAiCredits(ctx.user.id, "extract_ingredients", () =>
          extractIngredientsForMeal({
            userId: ctx.user.id,
            householdId: ctx.household.id,
            mealId: input.mealId
          })
        );
        return { ingredients };
      } catch (error) {
        const credit = mapCreditError(error);
        if (credit) throw credit;
        const gated = mapGateError(error);
        if (gated) throw gated;
        if (error instanceof NoRecipeTextError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: error.message,
            cause: { reason: "NO_RECIPE_TEXT" }
          });
        }
        const message = error instanceof Error ? error.message : "Unknown error.";
        if (message.toLowerCase().includes("not authorized")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Meal not found.",
            cause: { reason: "NOT_FOUND" }
          });
        }
        logger.warn("trpc_ai_extract_ingredients_failed", {
          userId: ctx.user.id,
          mealId: input.mealId,
          error: message
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "We couldn't extract ingredients. Please try again.",
          cause: { reason: "AI_PROVIDER_ERROR" }
        });
      }
    }),

  /**
   * Generate the WhatsApp-shareable plain-text recipe. The underlying
   * service already returns a discriminated-union; map each branch.
   */
  generateShareableRecipe: householdMemberProcedure
    .use(rateLimit("ai"))
    .input(mealIdInput)
    .mutation(async ({ ctx, input }) => {
      const result = await generateShareableRecipe(
        ctx.user.id,
        ctx.household.id,
        input.mealId
      );
      if (result.ok) {
        return { text: result.text };
      }
      switch (result.code) {
        case "RECIPE_MISSING":
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: result.message,
            cause: { reason: "RECIPE_MISSING" }
          });
        case "UPGRADE_REQUIRED":
          throw new TRPCError({
            code: "FORBIDDEN",
            message: result.message,
            cause: { reason: "UPGRADE_REQUIRED", feature: result.feature }
          });
        case "RATE_LIMITED":
          // Service-level rate limit is separate from the procedure's
          // tRPC rate-limit middleware (different bucket). Mirror the
          // same wire shape.
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: result.message,
            cause: { reason: "RATE_LIMITED", kind: "ai_share" }
          });
        case "AI_ERROR":
        default:
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: result.message,
            cause: { reason: "AI_ERROR" }
          });
      }
    })
});
