import "server-only";

import { getServerEnv } from "@/lib/env/server";
import { getResendClient } from "@/lib/email/resend-client";
import { trackEvent } from "@/lib/observability/analytics";
import { eeatlyEmailTags, recordOutboundEmailFromApiSend } from "@/services/email-delivery";

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * Admin reply to a beta-feedback submission. Sends a plain personal email
 * from the eeatly support address, quoting the cook's original message so the
 * reply has context. Mirrors `sendMagicLinkEmail`: when Resend is unconfigured
 * it logs to the console instead of throwing, so local dev stays functional.
 *
 * No status/thread is persisted — the reply is fire-and-send. Threaded support
 * (status, history) is deferred until the feedback schema gains those columns.
 */
export async function sendFeedbackReplyEmail(params: {
  to: string;
  recipientName?: string | null;
  replyMessage: string;
  originalMessage?: string | null;
  userId?: string | null;
}) {
  const resend = getResendClient();
  const { EMAIL_FROM } = getServerEnv();

  const greeting = params.recipientName?.trim()
    ? `Hi ${params.recipientName.trim()},`
    : "Hi,";

  if (!resend || !EMAIL_FROM) {
    console.info(
      `eeatly feedback reply to ${params.to}:\n${params.replyMessage}`
    );
    return { skipped: true as const };
  }

  const replyHtml = escapeHtml(params.replyMessage).replaceAll("\n", "<br />");
  const quotedBlock = params.originalMessage?.trim()
    ? `<hr style="border:none;border-top:1px solid #e5e3dc;margin:20px 0" />
       <p style="color:#6b6a63;font-size:13px;margin:0 0 6px">You wrote:</p>
       <blockquote style="margin:0;padding:0 0 0 12px;border-left:3px solid #e5e3dc;color:#6b6a63;font-size:14px;white-space:pre-wrap">${escapeHtml(
         params.originalMessage.trim()
       )}</blockquote>`
    : "";

  const sendResult = await resend.emails.send({
    from: EMAIL_FROM,
    to: params.to,
    subject: "Re: your eeatly feedback",
    text: `${greeting}\n\n${params.replyMessage}${
      params.originalMessage?.trim()
        ? `\n\n— You wrote:\n${params.originalMessage.trim()}`
        : ""
    }\n\n— The eeatly team`,
    html: `
      <p>${escapeHtml(greeting)}</p>
      <p style="white-space:pre-wrap">${replyHtml}</p>
      ${quotedBlock}
      <p style="color:#6b6a63;font-size:13px;margin-top:20px">— The eeatly team</p>
    `,
    tags: eeatlyEmailTags({
      template: "feedback_reply",
      userId: params.userId ?? undefined
    })
  });

  if (sendResult.error) {
    console.info(
      `eeatly feedback reply to ${params.to} (send failed: ${sendResult.error.message})`
    );
    return { skipped: true as const, detail: sendResult.error.message };
  }

  const providerId = sendResult.data?.id;

  if (providerId) {
    await recordOutboundEmailFromApiSend({
      providerMessageId: providerId,
      templateKey: "feedback_reply",
      recipient: params.to.trim().toLowerCase(),
      userId: params.userId ?? null,
      detail: { kind: "feedback_reply" }
    });

    trackEvent({
      name: "email_sent",
      userId: params.userId ?? undefined,
      metadata: {
        template: "feedback_reply",
        provider_message_id: providerId,
        channel: "resend"
      }
    });
  }

  return { skipped: false as const };
}
