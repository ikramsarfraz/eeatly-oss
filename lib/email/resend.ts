import "server-only";

import { getServerEnv } from "@/lib/env/server";
import { getResendClient } from "@/lib/email/resend-client";
import { trackEvent } from "@/lib/observability/analytics";
import { cookloopEmailTags, recordOutboundEmailFromApiSend } from "@/services/email-delivery";

export { getResendClient } from "@/lib/email/resend-client";

export async function sendMagicLinkEmail(email: string, url: string) {
  const resend = getResendClient();
  const { EMAIL_FROM } = getServerEnv();

  if (!resend || !EMAIL_FROM) {
    console.info(`CookLoop sign-in link for ${email}: ${url}`);
    return { skipped: true };
  }

  const sendResult = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: "Sign in to CookLoop",
    text: `Use this link to sign in to CookLoop: ${url}`,
    html: `
      <p>Use this link to sign in to CookLoop:</p>
      <p><a href="${url}">Sign in to CookLoop</a></p>
      <p>This link expires soon. If you did not request it, you can ignore this email.</p>
    `,
    tags: cookloopEmailTags({ template: "magic_link" })
  });

  if (sendResult.error) {
    console.info(`CookLoop sign-in link for ${email}: ${url}`);
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

export { sendWelcomeEmail } from "@/lib/email/transactional";
