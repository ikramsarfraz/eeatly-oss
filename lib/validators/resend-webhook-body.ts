import { z } from "zod";

export const HANDLED_EMAIL_WEBHOOK_TYPES = [
  "email.sent",
  "email.delivered",
  "email.opened",
  "email.clicked",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.delivery_delayed",
  "email.suppressed"
] as const;

export type HandledEmailWebhookType = (typeof HANDLED_EMAIL_WEBHOOK_TYPES)[number];

export const HANDLED_WEBHOOK_TYPE_SET = new Set<string>(HANDLED_EMAIL_WEBHOOK_TYPES);

/**
 * Loose shape after cryptographic verification — validates structure only.
 * See Resend webhook event reference for payloads.
 */
const emailEventDataSchema = z.object({
  email_id: z.string(),
  to: z
    .union([z.array(z.string()), z.string()])
    .transform((value) => (Array.isArray(value) ? value : [value])),
  subject: z.string().optional(),
  from: z.string().optional(),
  created_at: z.string().optional(),
  tags: z.record(z.string(), z.string()).optional(),
  bounce: z
    .object({
      message: z.string().optional(),
      subType: z.string().optional(),
      type: z.string().optional()
    })
    .optional(),
  failed: z
    .object({
      reason: z.string().optional()
    })
    .optional(),
  suppressed: z
    .object({
      message: z.string().optional(),
      type: z.string().optional()
    })
    .optional(),
  click: z
    .object({
      link: z.string().optional(),
      ipAddress: z.string().optional(),
      userAgent: z.string().optional(),
      timestamp: z.string().optional()
    })
    .optional()
});

export const verifiedResendWebhookBodySchema = z.object({
  type: z.enum(HANDLED_EMAIL_WEBHOOK_TYPES),
  created_at: z.string(),
  data: emailEventDataSchema
});

export type ParsedResendWebhookBody = z.infer<typeof verifiedResendWebhookBodySchema>;
