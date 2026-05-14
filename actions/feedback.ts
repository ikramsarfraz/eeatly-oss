"use server";

import { logger } from "@/lib/observability/logger";
import { trackActivationFunnelEvent } from "@/lib/observability/funnel";
import { requireCurrentUser } from "@/lib/auth/session";
import { checkFeedbackLimit } from "@/lib/security/rate-limit";
import { createBetaFeedback } from "@/services/feedback";
import { feedbackInputSchema, type FeedbackInput } from "@/lib/validators/feedback";

/**
 * Round 4.7: discriminated-union return matching the Round 4 action pattern.
 *   - `INVALID_INPUT`: Zod validation failed (empty message, wrong shape).
 *   - `RATE_LIMITED`: feedback throttle hit. UI shows generic.
 *   - `OTHER`: service-level failure. UI shows a generic toast.
 */
export type FeedbackResult =
  | { ok: true; feedbackId: string | undefined }
  | {
      ok: false;
      code: "INVALID_INPUT" | "RATE_LIMITED" | "OTHER";
      message?: string;
    };

export async function submitFeedbackAction(input: FeedbackInput): Promise<FeedbackResult> {
  const parsed = feedbackInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: parsed.error.issues[0]?.message ?? "Invalid feedback."
    };
  }

  const user = await requireCurrentUser();

  try {
    await checkFeedbackLimit(user.id);
  } catch {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many feedback submissions in a short time. Please try again later."
    };
  }

  try {
    const feedback = await createBetaFeedback(user.id, parsed.data);
    logger.info("beta_feedback_submitted", {
      userId: user.id,
      feedbackId: feedback?.id,
      type: feedback?.type
    });
    trackActivationFunnelEvent("feedback_submitted", {
      userId: user.id,
      metadata: {
        type: feedback?.type ?? parsed.data.type,
        hasContext: Boolean(parsed.data.context)
      }
    });
    return { ok: true, feedbackId: feedback?.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send feedback.";
    logger.warn("feedback_submit_failed", { userId: user.id, error: message });
    return { ok: false, code: "OTHER", message };
  }
}
