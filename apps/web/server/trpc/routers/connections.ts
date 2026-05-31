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
    .mutation(({ ctx, input }) => inviteConnection(ctx.user.id, input.email)),

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
