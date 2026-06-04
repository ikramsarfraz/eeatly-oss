import "server-only";

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { logger } from "@/lib/observability/logger";
import { trackActivationFunnelEvent } from "@/lib/observability/funnel";
import { feedbackInputSchema } from "@eeatly/api/validators/feedback";
import { createBetaFeedback, getFeedbackRecipient } from "@/services/feedback";
import { sendFeedbackReplyEmail } from "@/lib/email/feedback-reply";
import { adminProcedure, protectedProcedure, rateLimit, router } from "../trpc";

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
    }),

  /**
   * Admin reply-by-email. Sends the admin's message to the cook who submitted
   * the feedback, quoting their original note. No status/thread is persisted
   * (deferred until the feedback schema gains those columns) — this is a
   * fire-and-send so the admin can close the loop from the inbox.
   */
  reply: adminProcedure
    .use(rateLimit("mutation"))
    .input(
      z.object({
        feedbackId: z.string().uuid(),
        message: z.string().trim().min(1, "Reply can't be empty").max(5000)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const recipient = await getFeedbackRecipient(input.feedbackId);
      if (!recipient) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "That feedback no longer exists."
        });
      }

      try {
        const result = await sendFeedbackReplyEmail({
          to: recipient.email,
          recipientName: recipient.name,
          replyMessage: input.message,
          originalMessage: recipient.originalMessage,
          userId: recipient.userId
        });
        logger.info("beta_feedback_replied", {
          adminId: ctx.user.id,
          feedbackId: input.feedbackId,
          recipientUserId: recipient.userId,
          skipped: result.skipped
        });
        return { sent: !result.skipped, recipientEmail: recipient.email };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to send the reply.";
        logger.warn("trpc_feedback_reply_failed", {
          adminId: ctx.user.id,
          feedbackId: input.feedbackId,
          error: message
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    })
});
