import { z } from "zod";

// Email always stored + compared lowercased — Zod transforms before the
// downstream service inserts so callers can pass mixed-case input safely.
export const createInvitationSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .max(254, "Email is too long.")
    .transform((value) => value.toLowerCase())
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

// Tokens are base64url(32 bytes) = 43 chars after stripping padding. Min 32
// is conservative — anything shorter is malformed, not just an old format.
export const acceptInvitationSchema = z.object({
  token: z
    .string()
    .min(32, "Invitation token is malformed.")
    .max(128, "Invitation token is malformed.")
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const revokeInvitationSchema = z.object({
  invitationId: z.string().uuid("Invalid invitation id.")
});

export type RevokeInvitationInput = z.infer<typeof revokeInvitationSchema>;
