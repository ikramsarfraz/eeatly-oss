"use server";

import { logger } from "@/lib/observability/logger";
import { trackActivationFunnelEvent } from "@/lib/observability/funnel";
import { requireCurrentUser } from "@/lib/auth/session";
import { checkFeedbackLimit } from "@/lib/security/rate-limit";
import { createBetaFeedback } from "@/services/feedback";
import type { FeedbackInput } from "@/lib/validators/feedback";

export async function submitFeedbackAction(input: FeedbackInput) {
  const user = await requireCurrentUser();
  await checkFeedbackLimit(user.id);

  const feedback = await createBetaFeedback(user.id, input);
  logger.info("beta_feedback_submitted", {
    userId: user.id,
    feedbackId: feedback?.id,
    type: feedback?.type
  });
  trackActivationFunnelEvent("feedback_submitted", {
    userId: user.id,
    metadata: {
      type: feedback?.type ?? input.type,
      hasContext: Boolean(input.context)
    }
  });

  return { feedback: { id: feedback?.id } };
}
