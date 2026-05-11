import "server-only";

import * as React from "react";
import { getServerEnv } from "@/lib/env/server";
import { logEmailDelivery } from "@/lib/email/delivery-log";
import { eeatlyEmailTags, recordOutboundEmailFromApiSend } from "@/services/email-delivery";
import { getResendClient } from "@/lib/email/resend-client";
import { FirstMealEncouragementEmail } from "@/lib/email/templates/first-meal-encouragement-email";
import { InactiveReminderEmail } from "@/lib/email/templates/inactive-reminder-email";
import { WelcomeEmail } from "@/lib/email/templates/welcome-email";
import { WeeklyRecapEmail } from "@/lib/email/templates/weekly-recap-email";
import { trackEvent } from "@/lib/observability/analytics";
import { logger } from "@/lib/observability/logger";

export type TransactionalTemplate =
  | "welcome"
  | "first_meal_encouragement"
  | "inactive_reminder"
  | "weekly_recap_placeholder";

export type TransactionalEmailResult = {
  skipped: boolean;
  detail?: string;
};

export type DispatchTransactionalEmailInput = {
  template: TransactionalTemplate;
  toEmail: string;
  toName: string;
  userId?: string;
  /** Base app URL (dashboard links). Defaults to NEXT_PUBLIC_APP_URL. */
  appUrl?: string;
  /** For inactive reminder — shown in copy */
  daysQuiet?: number | null;
  /** Weekly recap placeholder line */
  recapTeaser?: string;
  /**
   * When true, record `reminder_email_sent` for analytics (non-blocking).
   * All templates use the same event with a `template` metadata key for filtering.
   */
  trackDispatch?: boolean;
};

function dashboardUrl(base: string) {
  const trimmed = base.replace(/\/$/, "");
  return `${trimmed}/dashboard`;
}

export async function dispatchTransactionalEmail(
  input: DispatchTransactionalEmailInput
): Promise<TransactionalEmailResult> {
  const resend = getResendClient();
  const { EMAIL_FROM } = getServerEnv();
  const baseUrl = input.appUrl ?? getServerEnv().NEXT_PUBLIC_APP_URL;
  const trackDispatch = input.trackDispatch !== false;

  if (!resend || !EMAIL_FROM) {
    logEmailDelivery({
      template: input.template,
      toEmail: input.toEmail,
      userId: input.userId,
      skipped: true,
      detail: "Missing Resend client or EMAIL_FROM",
      channel: "console"
    });

    return { skipped: true, detail: "Email not configured" };
  }

  const href = dashboardUrl(baseUrl);
  let subject = "eeatly";
  let element: React.ReactElement;

  switch (input.template) {
    case "welcome":
      subject = "Welcome to eeatly";
      element = React.createElement(WelcomeEmail, { name: input.toName });
      break;

    case "first_meal_encouragement":
      subject = "Log your first meal on eeatly";
      element = React.createElement(FirstMealEncouragementEmail, {
        name: input.toName,
        dashboardUrl: href
      });
      break;

    case "inactive_reminder":
      subject = "We miss seeing your cooks on eeatly";
      element = React.createElement(InactiveReminderEmail, {
        name: input.toName,
        dashboardUrl: href,
        daysQuiet: input.daysQuiet ?? null
      });
      break;

    case "weekly_recap_placeholder":
      subject = "Your eeatly week (preview)";
      element = React.createElement(WeeklyRecapEmail, {
        name: input.toName,
        teaserLine:
          input.recapTeaser ?? "Your personalized recap stitches together recent logs automatically."
      });
      break;

    default:
      return { skipped: true, detail: "Unknown template" };
  }

  try {
    const sendResult = await resend.emails.send({
      from: EMAIL_FROM,
      to: input.toEmail,
      subject,
      react: element,
      tags: eeatlyEmailTags({ template: input.template, userId: input.userId })
    });

    if (sendResult.error) {
      const message = sendResult.error.message ?? "Resend returned an error";

      logger.error("transactional_email_failed", {
        template: input.template,
        toEmail: input.toEmail,
        detail: message
      });

      logEmailDelivery({
        template: input.template,
        toEmail: input.toEmail,
        userId: input.userId,
        skipped: true,
        detail: message,
        channel: "resend_api"
      });

      return { skipped: true, detail: message };
    }

    const providerId = sendResult.data?.id;
    if (providerId) {
      await recordOutboundEmailFromApiSend({
        providerMessageId: providerId,
        templateKey: input.template,
        recipient: input.toEmail.trim().toLowerCase(),
        userId: input.userId,
        detail: { subject }
      });

      trackEvent({
        name: "email_sent",
        userId: input.userId,
        metadata: {
          template: input.template,
          provider_message_id: providerId,
          channel: "resend"
        }
      });
    }

    logEmailDelivery({
      template: input.template,
      toEmail: input.toEmail,
      userId: input.userId,
      skipped: false,
      providerMessageId: providerId,
      channel: "resend_api"
    });

    if (trackDispatch && input.userId) {
      trackEvent({
        name: "reminder_email_sent",
        userId: input.userId,
        metadata: {
          template: input.template,
          channel: "resend"
        }
      });
    }

    return { skipped: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send email";

    logger.error("transactional_email_failed", {
      template: input.template,
      toEmail: input.toEmail,
      detail: message
    });

    logEmailDelivery({
      template: input.template,
      toEmail: input.toEmail,
      userId: input.userId,
      skipped: true,
      detail: message,
      channel: "resend_api"
    });

    return { skipped: true, detail: message };
  }
}

/**
 * Same as dispatch, but intentionally fire-and-forget for auth-adjacent paths.
 */
export function scheduleTransactionalEmail(input: DispatchTransactionalEmailInput) {
  void dispatchTransactionalEmail(input).catch((error) => {
    logger.error("transactional_email_background_failed", {
      template: input.template,
      detail: error instanceof Error ? error.message : "unknown"
    });
  });
}

export async function sendWelcomeEmail(email: string, name: string, userId?: string) {
  return dispatchTransactionalEmail({
    template: "welcome",
    toEmail: email,
    toName: name,
    userId,
    trackDispatch: Boolean(userId)
  });
}
