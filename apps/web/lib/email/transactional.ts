import "server-only";

import * as React from "react";
import { getServerEnv } from "@/lib/env/server";
import { logEmailDelivery } from "@/lib/email/delivery-log";
import { eeatlyEmailTags, recordOutboundEmailFromApiSend } from "@/services/email-delivery";
import { getResendClient } from "@/lib/email/resend-client";
import { getMailSender, type MailIdentity } from "@/lib/email/senders";
import { AccountDeletedEmail } from "@/lib/email/templates/account-deleted-email";
import { ComplimentaryAccessEmail } from "@/lib/email/templates/complimentary-access-email";
import { FirstMealEncouragementEmail } from "@/lib/email/templates/first-meal-encouragement-email";
import { HouseholdInvitationEmail } from "@/lib/email/templates/household-invitation-email";
import { ConnectionInvitationEmail } from "@/lib/email/templates/connection-invitation-email";
import { HouseholdMemberRemovedEmail } from "@/lib/email/templates/household-member-removed-email";
import { InactiveReminderEmail } from "@/lib/email/templates/inactive-reminder-email";
import { WelcomeEmail } from "@/lib/email/templates/welcome-email";
import { WeeklyRecapEmail } from "@/lib/email/templates/weekly-recap-email";
import { trackEvent } from "@/lib/observability/analytics";
import { logger } from "@/lib/observability/logger";

export type TransactionalTemplate =
  | "welcome"
  | "first_meal_encouragement"
  | "inactive_reminder"
  | "weekly_recap_placeholder"
  | "household_invitation"
  | "connection_invitation"
  | "household_member_removed"
  | "complimentary_access"
  | "account_deleted";

/**
 * Which sender identity (From + Reply-To) each template ships under. Welcome
 * is the warm first touch; invitations come from hello@; everything else is an
 * automated activity notification (no-reply@ From, support@ Reply-To). Billing
 * / security / marketing identities exist in the registry for flows we haven't
 * built yet.
 */
const TEMPLATE_IDENTITY: Record<TransactionalTemplate, MailIdentity> = {
  welcome: "welcome",
  first_meal_encouragement: "notification",
  inactive_reminder: "notification",
  weekly_recap_placeholder: "notification",
  household_invitation: "invitation",
  connection_invitation: "invitation",
  household_member_removed: "notification",
  complimentary_access: "welcome",
  account_deleted: "notification"
};

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
  /** For inactive reminder — up to ~3 dish names to surface as
   *  "worth bringing back". Optional; the template renders fine when
   *  empty (general "log a meal" CTA, no list). */
  neglectedMealNames?: readonly string[];
  /** Weekly recap placeholder line */
  recapTeaser?: string;
  /** For household_invitation — passed straight into the template. */
  invitation?: {
    inviterName: string;
    householdName: string;
    inviteUrl: string;
    expiresInDays: number;
  };
  /** For connection_invitation (sharing-circle invite). */
  connectionInvitation?: {
    inviterName: string;
    inviteUrl: string;
    expiresInDays: number;
  };
  /** For household_member_removed — passed straight into the template. */
  removal?: {
    householdName: string;
  };
  /** For complimentary_access — admin-granted Pro days + when it ends. */
  complimentaryAccess?: {
    days: number;
    accessUntilLabel: string;
  };
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
  const { EMAIL_FROM, EMAIL_DOMAIN } = getServerEnv();
  const baseUrl = input.appUrl ?? getServerEnv().NEXT_PUBLIC_APP_URL;
  const trackDispatch = input.trackDispatch !== false;
  const sender = getMailSender(TEMPLATE_IDENTITY[input.template]);
  const contactEmail = sender.replyTo;

  if (!resend || (!EMAIL_FROM && !EMAIL_DOMAIN)) {
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
      subject = "Welcome to eeatly, your family's food memory";
      element = React.createElement(WelcomeEmail, {
        name: input.toName,
        dashboardUrl: href,
        contactEmail
      });
      break;

    case "first_meal_encouragement":
      subject = "That's one meal saved, here's what to try next";
      element = React.createElement(FirstMealEncouragementEmail, {
        name: input.toName,
        dashboardUrl: href,
        contactEmail
      });
      break;

    case "inactive_reminder":
      subject = "A few dishes worth bringing back";
      element = React.createElement(InactiveReminderEmail, {
        name: input.toName,
        dashboardUrl: href,
        daysQuiet: input.daysQuiet ?? null,
        neglectedMealNames: input.neglectedMealNames ?? [],
        contactEmail
      });
      break;

    case "account_deleted":
      subject = "Your eeatly account has been deleted";
      element = React.createElement(AccountDeletedEmail, {
        name: input.toName,
        contactEmail
      });
      break;

    case "complimentary_access": {
      const days = input.complimentaryAccess?.days ?? 0;
      subject = `You've got ${days} ${days === 1 ? "day" : "days"} of Master Chef on us`;
      element = React.createElement(ComplimentaryAccessEmail, {
        name: input.toName,
        days,
        accessUntilLabel: input.complimentaryAccess?.accessUntilLabel ?? "",
        dashboardUrl: href,
        contactEmail
      });
      break;
    }

    case "weekly_recap_placeholder":
      subject = "Your eeatly week (preview)";
      element = React.createElement(WeeklyRecapEmail, {
        name: input.toName,
        teaserLine:
          input.recapTeaser ?? "Your personalized recap stitches together recent logs automatically.",
        contactEmail
      });
      break;

    case "household_invitation": {
      if (!input.invitation) {
        // Required payload missing — return a skipped result rather than
        // hitting Resend with a template the caller didn't fully populate.
        // Treat as a programmer error; the action layer should never get
        // here unless the wiring is wrong.
        logger.error("transactional_email_invitation_missing_payload", {
          toEmail: input.toEmail
        });
        return { skipped: true, detail: "Invitation payload missing" };
      }
      subject = `${input.invitation.inviterName} invited you to ${input.invitation.householdName} on eeatly`;
      element = React.createElement(HouseholdInvitationEmail, {
        ...input.invitation,
        contactEmail
      });
      break;
    }

    case "connection_invitation": {
      if (!input.connectionInvitation) {
        logger.error("transactional_email_connection_invite_missing_payload", {
          toEmail: input.toEmail
        });
        return { skipped: true, detail: "Connection invitation payload missing" };
      }
      subject = `${input.connectionInvitation.inviterName} wants to share recipes with you on eeatly`;
      element = React.createElement(ConnectionInvitationEmail, {
        ...input.connectionInvitation,
        contactEmail
      });
      break;
    }

    case "household_member_removed": {
      if (!input.removal) {
        logger.error("transactional_email_removal_missing_payload", {
          toEmail: input.toEmail
        });
        return { skipped: true, detail: "Removal payload missing" };
      }
      subject = `You've been removed from ${input.removal.householdName} on eeatly`;
      element = React.createElement(HouseholdMemberRemovedEmail, {
        name: input.toName,
        householdName: input.removal.householdName,
        contactEmail
      });
      break;
    }

    default:
      return { skipped: true, detail: "Unknown template" };
  }

  try {
    const sendResult = await resend.emails.send({
      from: sender.from,
      replyTo: sender.replyTo,
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

/**
 * Round 9 — sent during the account deletion flow, BEFORE the user row
 * tears down. After tear-down the `userId` is gone, so the dispatch call
 * still records analytics keyed to the (now-deleted) user; that's fine
 * — the events table keeps `user_id` rows after the user is gone, just
 * deidentified.
 */
export async function sendAccountDeletedEmail(
  email: string,
  name: string,
  userId?: string
) {
  return dispatchTransactionalEmail({
    template: "account_deleted",
    toEmail: email,
    toName: name,
    userId,
    trackDispatch: Boolean(userId)
  });
}
