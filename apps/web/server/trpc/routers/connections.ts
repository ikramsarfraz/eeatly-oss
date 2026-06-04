import "server-only";

import { z } from "zod";
import {
  acceptInvitation,
  cancelInvitation,
  findInvitationByToken,
  getPeopleOverview,
  inviteConnection,
  listOwnedShareableItems
} from "@/services/connections";
import { dispatchTransactionalEmail } from "@/lib/email/transactional";
import { protectedProcedure, publicProcedure, rateLimit, router } from "../trpc";

/**
 * People / sharing-circle procedures (Phase 2). User-scoped — connections
 * are per-user, not household-scoped.
 */
export const connectionsRouter = router({
  /** Everything the People page renders. */
  peopleOverview: protectedProcedure.query(({ ctx }) => getPeopleOverview(ctx.user.id)),

  /** The viewer's owned recipes + plans, for the "+ Share something" picker. */
  ownedItems: protectedProcedure.query(({ ctx }) => listOwnedShareableItems(ctx.user.id)),

  /** Public: resolve an invite token for the accept page. */
  invitationByToken: publicProcedure
    .input(z.object({ token: z.string().min(8).max(256) }))
    .query(({ input }) => findInvitationByToken(input.token)),

  invite: protectedProcedure
    .use(rateLimit("invitation"))
    .input(z.object({ email: z.string().email().max(320) }))
    .mutation(async ({ ctx, input }) => {
      const result = await inviteConnection(ctx.user.id, input.email);
      // Email the invite (fire-and-forget; falls back to console when
      // Resend isn't configured). The copyable link is still returned.
      if (result.ok) {
        void dispatchTransactionalEmail({
          template: "connection_invitation",
          toEmail: input.email,
          toName: input.email,
          userId: ctx.user.id,
          connectionInvitation: {
            inviterName: ctx.user.name?.trim() || ctx.user.email.split("@")[0] || "Someone",
            inviteUrl: result.url,
            expiresInDays: 14
          }
        }).catch(() => undefined);
      }
      return result;
    }),

  cancelInvitation: protectedProcedure
    .use(rateLimit("mutation"))
    .input(z.object({ invitationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await cancelInvitation(ctx.user.id, input.invitationId);
      return { ok: true as const };
    }),

  acceptInvitation: protectedProcedure
    .use(rateLimit("mutation"))
    .input(z.object({ token: z.string().min(8).max(256) }))
    .mutation(({ ctx, input }) => acceptInvitation(ctx.user.id, input.token))
});
