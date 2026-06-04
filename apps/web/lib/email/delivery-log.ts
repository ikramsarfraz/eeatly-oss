import "server-only";

import { logger } from "@/lib/observability/logger";

export type EmailDeliveryLogPayload = {
  template: string;
  toEmail: string;
  userId?: string;
  skipped: boolean;
  detail?: string;
  /** Stable Resend email id when API returns it. */
  providerMessageId?: string;
  channel?: "resend_api" | "resend_webhook" | "console";
};

/**
 * Placeholder persistence hook — swap with a dedicated outbound_email_logs table later.
 */
export function logEmailDelivery(payload: EmailDeliveryLogPayload) {
  logger.info("transactional_email", {
    channel: payload.channel ?? "resend",
    template: payload.template,
    toEmail: payload.toEmail,
    userId: payload.userId,
    skipped: payload.skipped,
    detail: payload.detail,
    providerMessageId: payload.providerMessageId
  });
}
