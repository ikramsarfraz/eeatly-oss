import "server-only";

import { TRPCError } from "@trpc/server";
import {
  AudioInvalidFormatError,
  AudioTooLargeError,
  AudioTooShortOrEmptyError,
  AudioTranscriptionFailedError
} from "@/lib/errors/audio";
import { FeatureGateDeniedError } from "@/lib/errors/gates";
import { logger } from "@/lib/observability/logger";
import {
  sessionOnlyInputSchema,
  startSessionInputSchema,
  submitPhotoTurnInputSchema,
  submitTextTurnInputSchema,
  submitVoiceTurnInputSchema,
  toggleTurnAcceptedInputSchema
} from "@eeatly/api/validators/refine";
import {
  discardSession,
  getSessionState,
  saveSession,
  startSession,
  submitPhotoTurn,
  submitTextTurn,
  submitVoiceTurn,
  toggleTurnAccepted
} from "@/services/refine";
import { protectedProcedure, rateLimit, router } from "../trpc";

/**
 * Round 18 — Refine recipe (AI-prompted editing) tRPC router.
 *
 * Authz model:
 *   - All procedures require auth (`protectedProcedure`).
 *   - Service-layer `requireHouseholdMember` runs against the meal's
 *     household at session start; subsequent procedures revalidate
 *     session ownership (user must own the session, not just the
 *     household).
 *   - Per the design spec, sessions are user-scoped — household members
 *     don't share refine drafts. The service enforces this.
 *
 * Gating:
 *   - Text / voice / photo submissions inherit the existing feature
 *     gates (`ai_suggest_text`, `ai_suggest_voice`, `ai_suggest_image`)
 *     via the `requireFeatureAccess` call inside the AI service. The
 *     router doesn't double-check; gate denials become FORBIDDEN via
 *     the `mapServiceError` branch below.
 *
 * Rate limiting:
 *   - AI-touching procedures compose `rateLimit("ai")` — same bucket
 *     the existing Capture procedures use.
 *   - Read-only `getPendingChanges` skips rate limiting (cheap query,
 *     no AI call).
 */

function mapServiceError(error: unknown): never {
  if (error instanceof FeatureGateDeniedError) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: error.message,
      cause: { reason: "UPGRADE_REQUIRED", feature: error.feature }
    });
  }
  if (error instanceof AudioTooLargeError) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: { reason: "AUDIO_TOO_LARGE" }
    });
  }
  if (error instanceof AudioInvalidFormatError) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: { reason: "AUDIO_INVALID_FORMAT" }
    });
  }
  if (error instanceof AudioTooShortOrEmptyError) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error.message,
      cause: { reason: "AUDIO_TOO_SHORT_OR_EMPTY" }
    });
  }
  if (error instanceof AudioTranscriptionFailedError) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
      cause: { reason: "AUDIO_TRANSCRIPTION_FAILED" }
    });
  }
  if (error instanceof Error) {
    const msg = error.message;
    if (
      msg === "Meal not found." ||
      msg === "Refine session not found." ||
      msg === "Not authorized for this refine session."
    ) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: msg,
        cause: { reason: "NOT_FOUND" }
      });
    }
    if (
      msg === "Refine session is closed." ||
      msg === "Session already saved." ||
      msg === "Session was discarded."
    ) {
      throw new TRPCError({
        code: "CONFLICT",
        message: msg,
        cause: { reason: "SESSION_NOT_ACTIVE" }
      });
    }
    if (msg.toLowerCase().includes("not authorized")) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Not authorized for this household.",
        cause: { reason: "NOT_HOUSEHOLD_MEMBER" }
      });
    }
    // Refine is a write surface — only the meal's creator can edit it.
    // Non-creators (household co-members, people it's shared with) get a
    // clean FORBIDDEN instead of a 500. The recipe view also hides the
    // Refine button from them, so this is defense-in-depth.
    if (msg === "Only the creator can refine this meal.") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only the recipe's owner can refine it. Save a copy to make your own changes.",
        cause: { reason: "NOT_CREATOR" }
      });
    }
  }
  logger.warn("refine_unexpected_error", {
    error: error instanceof Error ? error.message : String(error)
  });
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Refine flow hit an unexpected error. Try again.",
    cause: { reason: "INTERNAL" }
  });
}

export const refineRouter = router({
  startSession: protectedProcedure
    .input(startSessionInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await startSession({
          userId: ctx.user.id,
          mealId: input.mealId,
          deviceId: input.deviceId
        });
      } catch (error) {
        mapServiceError(error);
      }
    }),

  getPendingChanges: protectedProcedure
    .input(sessionOnlyInputSchema)
    .query(async ({ ctx, input }) => {
      try {
        return await getSessionState({
          userId: ctx.user.id,
          sessionId: input.sessionId
        });
      } catch (error) {
        mapServiceError(error);
      }
    }),

  submitTextTurn: protectedProcedure
    .use(rateLimit("ai"))
    .input(submitTextTurnInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await submitTextTurn({
          userId: ctx.user.id,
          sessionId: input.sessionId,
          prompt: input.prompt
        });
      } catch (error) {
        mapServiceError(error);
      }
    }),

  submitVoiceTurn: protectedProcedure
    .use(rateLimit("ai"))
    .input(submitVoiceTurnInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const buffer = Buffer.from(input.audioBase64, "base64");
        return await submitVoiceTurn({
          userId: ctx.user.id,
          sessionId: input.sessionId,
          audioBuffer: buffer,
          mediaType: input.mediaType,
          fileName: input.fileName
        });
      } catch (error) {
        mapServiceError(error);
      }
    }),

  submitPhotoTurn: protectedProcedure
    .use(rateLimit("ai"))
    .input(submitPhotoTurnInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await submitPhotoTurn({
          userId: ctx.user.id,
          sessionId: input.sessionId,
          imageBase64: input.imageBase64,
          mediaType: input.mediaType
        });
      } catch (error) {
        mapServiceError(error);
      }
    }),

  toggleTurnAccepted: protectedProcedure
    .input(toggleTurnAcceptedInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await toggleTurnAccepted({
          userId: ctx.user.id,
          sessionId: input.sessionId,
          turnId: input.turnId,
          accepted: input.accepted
        });
      } catch (error) {
        mapServiceError(error);
      }
    }),

  save: protectedProcedure
    .use(rateLimit("mutation"))
    .input(sessionOnlyInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await saveSession({
          userId: ctx.user.id,
          sessionId: input.sessionId
        });
      } catch (error) {
        mapServiceError(error);
      }
    }),

  discard: protectedProcedure
    .input(sessionOnlyInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        return await discardSession({
          userId: ctx.user.id,
          sessionId: input.sessionId
        });
      } catch (error) {
        mapServiceError(error);
      }
    })
});
