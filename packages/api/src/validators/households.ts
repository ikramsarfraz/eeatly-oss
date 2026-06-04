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
//
// `dryRun` (R15.5 Task 6): when true the procedure computes the merge
// preview (meals/logs that would move, target kitchen name) without
// committing. The UI calls dryRun first to render a confirmation card,
// then calls without dryRun to actually accept.
export const acceptInvitationSchema = z.object({
  token: z
    .string()
    .min(32, "Invitation token is malformed.")
    .max(128, "Invitation token is malformed."),
  dryRun: z.boolean().optional()
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

export const revokeInvitationSchema = z.object({
  invitationId: z.string().uuid("Invalid invitation id.")
});

export type RevokeInvitationInput = z.infer<typeof revokeInvitationSchema>;

// Target user ids are Better Auth ids (text, not uuid). We accept any
// non-empty string ≤ 128 chars — the service performs the real existence
// + role checks.
export const removeMemberSchema = z.object({
  targetUserId: z
    .string()
    .min(1, "Missing member id.")
    .max(128, "Invalid member id.")
});

export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;
