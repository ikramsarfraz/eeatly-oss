import "server-only";

import { TRPCError } from "@trpc/server";
import { logger } from "@/lib/observability/logger";
import { trackActivationFunnelEvent } from "@/lib/observability/funnel";
import { feedbackInputSchema } from "@/lib/validators/feedback";
import { createBetaFeedback } from "@/services/feedback";
import { protectedProcedure, rateLimit, router } from "../trpc";

/**
 * Round 11 — beta feedback. Rate-limited per the existing feedback
 * bucket (10/hour). The activation-funnel side effect stays alongside
 * the mutation so the trigger semantics match the Round 4.7 action.
 */
export const feedbackRouter = router({
  submit: protectedProcedure
    .use(rateLimit("feedback"))
    .input(feedbackInputSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const feedback = await createBetaFeedback(ctx.user.id, input);
        logger.info("beta_feedback_submitted", {
          userId: ctx.user.id,
          feedbackId: feedback?.id,
          type: feedback?.type
        });
        trackActivationFunnelEvent("feedback_submitted", {
          userId: ctx.user.id,
          metadata: {
            type: feedback?.type ?? input.type,
            hasContext: Boolean(input.context)
          }
        });
        return { feedbackId: feedback?.id };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to send feedback.";
        logger.warn("trpc_feedback_submit_failed", {
          userId: ctx.user.id,
          error: message
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message
        });
      }
    })
});
