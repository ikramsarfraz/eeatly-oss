import "server-only";

import * as React from "react";
import { getServerEnv } from "@/lib/env/server";
import { getResendClient } from "@/lib/email/resend-client";
import { getMailSender } from "@/lib/email/senders";
import { MagicLinkEmail } from "@/lib/email/templates/magic-link-email";
import { PasswordResetEmail } from "@/lib/email/templates/password-reset-email";
import { trackEvent } from "@/lib/observability/analytics";
import { eeatlyEmailTags, recordOutboundEmailFromApiSend } from "@/services/email-delivery";

export { getResendClient } from "@/lib/email/resend-client";

export async function sendMagicLinkEmail(email: string, url: string) {
  const resend = getResendClient();
  const { EMAIL_FROM, EMAIL_DOMAIN } = getServerEnv();

  if (!resend || (!EMAIL_FROM && !EMAIL_DOMAIN)) {
    console.info(`eeatly sign-in link for ${email}: ${url}`);
    return { skipped: true };
  }

  // Magic link is the warm first touch (signup / sign-in) — hello@ From,
  // support@ Reply-To.
  const sender = getMailSender("welcome");

  const sendResult = await resend.emails.send({
    from: sender.from,
    replyTo: sender.replyTo,
    to: email,
    subject: "Sign in to eeatly",
    text: `Sign in to eeatly using this link (expires soon, one-time use): ${url}\n\nIf you didn't request it, you can ignore this email.`,
    react: React.createElement(MagicLinkEmail, {
      url,
      contactEmail: sender.replyTo
    }),
    tags: eeatlyEmailTags({ template: "magic_link" })
  });

  if (sendResult.error) {
    console.info(`eeatly sign-in link for ${email}: ${url}`);
    return { skipped: true, detail: sendResult.error.message };
  }

  const providerId = sendResult.data?.id;

  if (providerId) {
    await recordOutboundEmailFromApiSend({
      providerMessageId: providerId,
      templateKey: "magic_link",
      recipient: email.trim().toLowerCase(),
      userId: null,
      detail: { kind: "magic_link" }
    });

    trackEvent({
      name: "email_sent",
      metadata: {
        template: "magic_link",
        provider_message_id: providerId,
        channel: "resend"
      }
    });
  }

  return { skipped: false };
}

export async function sendPasswordResetEmail(email: string, url: string) {
  const resend = getResendClient();
  const { EMAIL_FROM, EMAIL_DOMAIN } = getServerEnv();

  if (!resend || (!EMAIL_FROM && !EMAIL_DOMAIN)) {
    console.info(`eeatly password reset link for ${email}: ${url}`);
    return { skipped: true };
  }

  // Automated security mail — no-reply@ From, support@ Reply-To.
  const sender = getMailSender("password_reset");

  const sendResult = await resend.emails.send({
    from: sender.from,
    replyTo: sender.replyTo,
    to: email,
    subject: "Reset your eeatly password",
    text: `Reset your eeatly password using this link (expires in an hour, one-time use): ${url}\n\nIf you didn't request it, you can ignore this email. Your password stays the same.`,
    react: React.createElement(PasswordResetEmail, {
      url,
      contactEmail: sender.replyTo
    }),
    tags: eeatlyEmailTags({ template: "password_reset" })
  });

  if (sendResult.error) {
    console.info(`eeatly password reset link for ${email}: ${url}`);
    return { skipped: true, detail: sendResult.error.message };
  }

  const providerId = sendResult.data?.id;

  if (providerId) {
    await recordOutboundEmailFromApiSend({
      providerMessageId: providerId,
      templateKey: "password_reset",
      recipient: email.trim().toLowerCase(),
      userId: null,
      detail: { kind: "password_reset" }
    });

    trackEvent({
      name: "email_sent",
      metadata: {
        template: "password_reset",
        provider_message_id: providerId,
        channel: "resend"
      }
    });
  }

  return { skipped: false };
}

export { sendWelcomeEmail } from "@/lib/email/transactional";
