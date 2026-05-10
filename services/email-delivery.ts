import "server-only";

import { desc, eq, inArray, or } from "drizzle-orm";

import { emailDeliveryLogs } from "@/db/schema";
import {
  pickStrongerDeliveryStatus,
  type EmailDeliveryStatus
} from "@/lib/email/delivery-status";
import { logEmailDelivery } from "@/lib/email/delivery-log";
import { db } from "@/lib/db/client";
import type { AnalyticsEventName } from "@/lib/observability/analytics";
import { trackEvent } from "@/lib/observability/analytics";
import { logger } from "@/lib/observability/logger";
import type { HandledEmailWebhookType } from "@/lib/validators/resend-webhook-body";
import type { ParsedResendWebhookBody } from "@/lib/validators/resend-webhook-body";

export type EmailDeliveryAdminFilter = "all" | "failed" | "bounced" | "opened" | "clicked";

/** Tag value: letters, digits, underscore, dash only (Resend constraint). */
export function isSafeResendTagValue(value: string) {
  return /^[a-zA-Z0-9_-]{1,256}$/.test(value);
}

export function cookloopEmailTags(options: { template: string; userId?: string }) {
  const tags: { name: string; value: string }[] = [
    { name: "cookloop_template", value: options.template }
  ];

  if (options.userId && isSafeResendTagValue(options.userId)) {
    tags.push({ name: "cookloop_user_id", value: options.userId });
  }

  return tags;
}

export function mapWebhookTypeToDeliveryStatus(
  type: HandledEmailWebhookType
): EmailDeliveryStatus {
  switch (type) {
    case "email.sent":
      return "sent";
    case "email.delivered":
      return "delivered";
    case "email.opened":
      return "opened";
    case "email.clicked":
      return "clicked";
    case "email.bounced":
      return "bounced";
    case "email.complained":
      return "complained";
    case "email.failed":
      return "failed";
    case "email.delivery_delayed":
      return "delayed";
    case "email.suppressed":
      return "suppressed";
    default: {
      const never: never = type;
      throw new Error(`Unhandled webhook type: ${never as string}`);
    }
  }
}

function analyticsForWebhook(type: HandledEmailWebhookType): AnalyticsEventName | null {
  switch (type) {
    case "email.sent":
      return null;
    case "email.delivered":
      return "email_delivered";
    case "email.opened":
      return "email_opened";
    case "email.clicked":
      return "email_clicked";
    case "email.bounced":
      return "email_bounced";
    case "email.complained":
      return "email_complained";
    case "email.failed":
    case "email.suppressed":
      return "email_delivery_failed";
    case "email.delivery_delayed":
      return null;
    default: {
      const never: never = type;
      throw new Error(`Unhandled webhook type for analytics: ${never as string}`);
    }
  }
}

function webhookFailureReason(
  type: HandledEmailWebhookType,
  data: ParsedResendWebhookBody["data"]
): string | null {
  if (type === "email.bounced" && data.bounce?.message) {
    return data.bounce.message;
  }

  if (type === "email.failed" && data.failed?.reason) {
    return data.failed.reason;
  }

  if (type === "email.suppressed" && data.suppressed?.message) {
    return data.suppressed.message;
  }

  return null;
}

function mergeDeliveryMetadata(
  existing: Record<string, string | number | boolean | null> | null | undefined,
  patch: Record<string, string | number | boolean | null>
): Record<string, string | number | boolean | null> {
  return {
    ...(existing ?? {}),
    ...patch
  };
}

/** Called after successful Resend `emails.send` so admin has a row before webhooks arrive. */
export async function recordOutboundEmailFromApiSend(params: {
  providerMessageId: string;
  templateKey: string;
  recipient: string;
  userId?: string | null;
  detail?: Record<string, string | number | boolean | null>;
}) {
  const now = new Date();

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(emailDeliveryLogs)
      .where(eq(emailDeliveryLogs.providerMessageId, params.providerMessageId))
      .limit(1);

    const metadata = mergeDeliveryMetadata(existing?.metadata, {
      source: "resend_api",
      ...params.detail
    });

    if (!existing) {
      await tx.insert(emailDeliveryLogs).values({
        providerMessageId: params.providerMessageId,
        templateKey: params.templateKey,
        recipient: params.recipient,
        userId: params.userId ?? null,
        status: "sent",
        failureReason: null,
        metadata,
        lastProviderEventType: "api.emails.send",
        lastEventAt: now,
        updatedAt: now
      });
      return;
    }

    const nextStatus = pickStrongerDeliveryStatus(existing.status as EmailDeliveryStatus, "sent");

    await tx
      .update(emailDeliveryLogs)
      .set({
        templateKey: existing.templateKey ?? params.templateKey,
        recipient: existing.recipient || params.recipient,
        userId: existing.userId ?? params.userId ?? null,
        status: nextStatus,
        metadata,
        lastProviderEventType: "api.emails.send",
        lastEventAt:
          existing.lastEventAt.getTime() > now.getTime() ? existing.lastEventAt : now,
        updatedAt: now
      })
      .where(eq(emailDeliveryLogs.id, existing.id));
  });

  logger.info("email_delivery_api_record", {
    providerMessageId: params.providerMessageId,
    templateKey: params.templateKey
  });
}

export async function applyResendWebhookToDeliveryLog(parsed: ParsedResendWebhookBody) {
  const incomingStatus = mapWebhookTypeToDeliveryStatus(parsed.type);
  const emailId = parsed.data.email_id;
  const recipient = (parsed.data.to[0] ?? "").trim();
  const templateKey = parsed.data.tags?.cookloop_template?.slice(0, 120) ?? null;
  const tagUserCandidate = parsed.data.tags?.cookloop_user_id;
  const userIdCandidate =
    tagUserCandidate && isSafeResendTagValue(tagUserCandidate) ? tagUserCandidate : null;
  const reason = webhookFailureReason(parsed.type, parsed.data);
  const eventAtNumber = Number.isNaN(Date.parse(parsed.created_at))
    ? Date.now()
    : Date.parse(parsed.created_at);

  const metadataExtras: Record<string, string | number | boolean | null> = {
    last_webhook_type: parsed.type
  };

  if (parsed.data.subject) {
    metadataExtras.subject = parsed.data.subject;
  }

  if (parsed.data.from) {
    metadataExtras.mail_from = parsed.data.from;
  }

  if (parsed.data.click?.link) {
    metadataExtras.click_link = parsed.data.click.link;
  }

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(emailDeliveryLogs)
      .where(eq(emailDeliveryLogs.providerMessageId, emailId))
      .limit(1);

    const nextStatus = existing
      ? pickStrongerDeliveryStatus(existing.status as EmailDeliveryStatus, incomingStatus)
      : incomingStatus;

    let mergedFailure = existing?.failureReason ?? null;
    if (reason && reason.trim().length > 0) {
      mergedFailure = reason;
    }

    const baseMetadata = mergeDeliveryMetadata(existing?.metadata ?? undefined, metadataExtras);

    const lastEvent =
      existing && existing.lastEventAt.getTime() > eventAtNumber
        ? existing.lastEventAt
        : new Date(eventAtNumber);
    const now = new Date();

    if (!existing) {
      await tx.insert(emailDeliveryLogs).values({
        providerMessageId: emailId,
        templateKey,
        recipient: recipient.length > 0 ? recipient.toLowerCase() : "(unknown)",
        userId: userIdCandidate,
        status: nextStatus,
        failureReason: mergedFailure,
        metadata: baseMetadata,
        lastProviderEventType: parsed.type,
        lastEventAt: lastEvent,
        updatedAt: now
      });
      return;
    }

    await tx
      .update(emailDeliveryLogs)
      .set({
        templateKey: existing.templateKey ?? templateKey,
        recipient:
          recipient.length > 0 ? recipient.toLowerCase() : existing.recipient || "(unknown)",
        userId: existing.userId ?? userIdCandidate,
        status: nextStatus,
        failureReason: mergedFailure,
        metadata: baseMetadata,
        lastProviderEventType: parsed.type,
        lastEventAt: lastEvent,
        updatedAt: now
      })
      .where(eq(emailDeliveryLogs.id, existing.id));
  });

  const analyticsName = analyticsForWebhook(parsed.type);
  if (analyticsName) {
    trackEvent({
      name: analyticsName,
      userId: userIdCandidate ?? undefined,
      metadata: {
        provider_message_id: emailId,
        webhook_type: parsed.type,
        template: templateKey ?? ""
      }
    });
  }

  logEmailDelivery({
    providerMessageId: emailId,
    template: templateKey ?? "unknown",
    toEmail: recipient.length > 0 ? recipient : "(unknown)",
    userId: userIdCandidate ?? undefined,
    skipped: false,
    channel: "resend_webhook",
    detail: parsed.type
  });
}

export async function listEmailDeliveryLogsForAdmin(options: {
  filter: EmailDeliveryAdminFilter;
  limit: number;
}) {
  const limit = Math.min(Math.max(options.limit, 1), 500);
  const statusCol = emailDeliveryLogs.status;

  const filterSql =
    options.filter === "all"
      ? undefined
      : options.filter === "bounced"
        ? eq(statusCol, "bounced")
        : options.filter === "failed"
          ? inArray(statusCol, ["failed", "suppressed", "delayed"])
          : options.filter === "opened"
            ? or(eq(statusCol, "opened"), eq(statusCol, "clicked"))
            : eq(statusCol, "clicked");

  const base = db.select().from(emailDeliveryLogs);
  const filtered = filterSql !== undefined ? base.where(filterSql) : base;

  return filtered.orderBy(desc(emailDeliveryLogs.lastEventAt)).limit(limit);
}
