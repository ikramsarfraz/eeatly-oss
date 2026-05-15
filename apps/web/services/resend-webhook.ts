import "server-only";

import { eq } from "drizzle-orm";

import { resendWebhookReceipts } from "@/db/schema";
import { HANDLED_WEBHOOK_TYPE_SET, verifiedResendWebhookBodySchema } from "@/lib/validators/resend-webhook-body";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";
import { applyResendWebhookToDeliveryLog } from "@/services/email-delivery";

export async function claimResendWebhookDelivery(svixId: string): Promise<boolean> {
  const rows = await db
    .insert(resendWebhookReceipts)
    .values({ svixId })
    .onConflictDoNothing()
    .returning({ svixId: resendWebhookReceipts.svixId });

  return rows.length > 0;
}

export async function releaseResendWebhookClaim(svixId: string) {
  await db.delete(resendWebhookReceipts).where(eq(resendWebhookReceipts.svixId, svixId));
}

/**
 * Validates shape then processes handled Resend email lifecycle events.
 *
 * Duplicate `svix-id` retries short-circuit after the receipts row conflicts.
 *
 * Caller must cryptographically verify the payload first.
 */
export async function ingestVerifiedResendPayload(body: unknown, svixId: string) {
  const type =
    typeof body === "object" && body !== null && "type" in body
      ? String((body as { type: unknown }).type)
      : "";

  if (!HANDLED_WEBHOOK_TYPE_SET.has(type)) {
    logger.info("resend_webhook_skip_event", { type, svixId });
    return { handled: false as const };
  }

  const parsed = verifiedResendWebhookBodySchema.safeParse(body);
  if (!parsed.success) {
    logger.warn("resend_webhook_parse_failed", {
      svixId,
      type,
      issues: String(parsed.error.message)
    });
    return { parseError: true as const };
  }

  const claimed = await claimResendWebhookDelivery(svixId);
  if (!claimed) {
    logger.info("resend_webhook_duplicate_delivery", { svixId, type });
    return { duplicate: true as const };
  }

  try {
    await applyResendWebhookToDeliveryLog(parsed.data);
    return { handled: true as const };
  } catch (error) {
    await releaseResendWebhookClaim(svixId);
    logger.error("resend_webhook_delivery_merge_failed", {
      svixId,
      type,
      detail: error instanceof Error ? error.message : "unknown"
    });
    throw error;
  }
}
