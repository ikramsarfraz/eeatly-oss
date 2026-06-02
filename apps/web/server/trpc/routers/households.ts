import "server-only";

import { revalidatePath } from "next/cache";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { isMobileOrigin, pickInviteUrl } from "@/lib/auth/deep-links";
import { dispatchTransactionalEmail } from "@/lib/email/transactional";
import { getServerEnv } from "@/lib/env/server";
import { FeatureGateDeniedError } from "@/lib/errors/gates";
import {
  CannotRemoveOwnerError,
  CannotRemoveSelfError,
  InvitationInvalidError,
  MealNameCollisionError,
  NotHouseholdOwnerError,
  NotMemberError,
  OwnershipTransferRequiredError,
  SoleOwnerCannotLeaveError
} from "@/lib/errors/households";
import { logger } from "@/lib/observability/logger";
import {
  acceptInvitationSchema,
  createInvitationSchema,
  removeMemberSchema,
  revokeInvitationSchema
} from "@eeatly/api/validators/households";
import { createNotification } from "@/services/notifications";
import {
  acceptHouseholdInvitation,
  countHouseholdMembers,
  createHouseholdInvitation,
  findInvitationContextByToken,
  leaveCurrentHousehold,
  listHouseholdMembers,
  listPendingInvitations,
  removeMemberFromHousehold,
  revokeHouseholdInvitation
} from "@/services/households";
import {
  householdMemberProcedure,
  householdOwnerProcedure,
  protectedProcedure,
  publicProcedure,
  rateLimit,
  router
} from "../trpc";

function buildInviteUrl(token: string, opts: { isMobile: boolean }): string {
  const base = getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const webUrl = `${base}/invite/${encodeURIComponent(token)}`;
  // Round 15.5 Task 4 — pick the right scheme based on the inviter's
  // request origin. Mobile inviters get `eeatly://invite/...` so the
  // recipient's tap deep-links directly into the app; web inviters
  // keep the https URL, which Universal Links (R15.5 Task 3) route
  // into the app when installed.
  return pickInviteUrl({ webUrl, token, isMobile: opts.isMobile });
}

/**
 * Round 11 — household reads.
 *
 * `current` returns the user's current household (resolved via the
 * tRPC ctx's memoized lookup) plus its member roster and total
 * count. Two queries internally; the page already pays for both.
 *
 * `pendingInvitations` is owner-only — non-owners shouldn't see who
 * else has been invited.
 *
 * `invitationByToken` is intentionally public — the accept page
 * needs to read the household name + inviter info before the
 * recipient signs in. The token is the access control.
 */
export const householdsRouter = router({
  current: householdMemberProcedure.query(async ({ ctx }) => {
    const [members, memberCount, household] = await Promise.all([
      listHouseholdMembers(ctx.user.id, ctx.household.id),
      countHouseholdMembers(ctx.user.id, ctx.household.id),
      ctx.getCurrentHousehold()
    ]);
    return {
      id: household.id,
      name: household.name,
      memberCount,
      members
    };
  }),

  pendingInvitations: householdOwnerProcedure.query(({ ctx }) =>
    listPendingInvitations(ctx.user.id, ctx.household.id)
  ),

  invitationByToken: publicProcedure
    .input(z.object({ token: z.string().min(8).max(256) }))
    .query(({ input }) => findInvitationContextByToken(input.token)),

  /**
   * Owner-only: create a pending invitation + dispatch the email. The
   * email send is fire-and-forget — the invitation row exists even if
   * the email send fails, and the owner can copy the link from the
   * pending-invitations list on settings.
   */
  invite: householdOwnerProcedure
    .use(rateLimit("invitation"))
    .input(createInvitationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await createHouseholdInvitation(
          ctx.user.id,
          ctx.household.id,
          input.email
        );

        // Pick the invite URL scheme based on the inviter's request
        // origin: mobile inviter → `eeatly://invite/...`; web inviter
        // → `https://eeatly.app/invite/...`. With Universal Links
        // configured (R15.5 Task 3), the https URL still deep-links
        // into the app on mobile devices, so the web URL stays the
        // robust default.
        const inviterIsMobile = isMobileOrigin(ctx.headers.get("origin"));
        void dispatchTransactionalEmail({
          template: "household_invitation",
          toEmail: input.email,
          toName: input.email,
          userId: ctx.user.id,
          invitation: {
            inviterName: result.inviterName,
            householdName: result.householdName,
            inviteUrl: buildInviteUrl(result.token, {
              isMobile: inviterIsMobile
            }),
            expiresInDays: Math.max(
              1,
              Math.round(
                (result.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)
              )
            )
          }
        }).catch((error) => {
          logger.warn("invitation_email_dispatch_failed", {
            userId: ctx.user.id,
            invitationId: result.invitationId,
            error: error instanceof Error ? error.message : String(error)
          });
        });

        logger.info("invitation_created", {
          userId: ctx.user.id,
          householdId: ctx.household.id,
          invitationId: result.invitationId
        });
        revalidatePath("/settings");
        return {
          invitationId: result.invitationId,
          expiresAt: result.expiresAt
        };
      } catch (error) {
        if (error instanceof FeatureGateDeniedError) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: error.message,
            cause: { reason: "UPGRADE_REQUIRED", feature: error.feature }
          });
        }
        throw error;
      }
    }),

  acceptInvitation: protectedProcedure
    .use(rateLimit("mutation"))
    .input(acceptInvitationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await acceptHouseholdInvitation(ctx.user.id, input.token, {
          dryRun: input.dryRun === true
        });

        // R15.5 Task 6 — dry-run path returns a preview shape and does
        // NOT side-effect (no notifications, no revalidation). The
        // discriminated return lets the UI render a confirmation card.
        if ("kind" in result && result.kind === "preview") {
          return {
            kind: "preview" as const,
            newHouseholdId: result.newHouseholdId,
            newHouseholdName: result.newHouseholdName,
            inviterName: result.inviterName,
            mealsToMerge: result.mealsToMerge,
            logsToMerge: result.logsToMerge,
            willDissolveCurrentHousehold: result.willDissolveCurrentHousehold
          };
        }

        // Notify the inviter — fire-and-forget; membership is committed.
        void createNotification({
          userId: result.inviterUserId,
          type: "household_invitation",
          title: `${ctx.user.name} joined ${result.newHouseholdName}`,
          body:
            "Their meals and cook history have been merged into your kitchen.",
          href: "/settings"
        }).catch((error) => {
          logger.warn("invitation_accept_notify_failed", {
            userId: ctx.user.id,
            newHouseholdId: result.newHouseholdId,
            error: error instanceof Error ? error.message : String(error)
          });
        });

        logger.info("invitation_accepted", {
          userId: ctx.user.id,
          newHouseholdId: result.newHouseholdId,
          mealsMoved: result.mealsMoved,
          logsMoved: result.logsMoved
        });
        revalidatePath("/home");
        revalidatePath("/library");
        revalidatePath("/ideas");
        revalidatePath("/settings");

        return {
          kind: "accepted" as const,
          newHouseholdId: result.newHouseholdId,
          newHouseholdName: result.newHouseholdName,
          mealsMoved: result.mealsMoved,
          logsMoved: result.logsMoved
        };
      } catch (error) {
        if (error instanceof InvitationInvalidError) {
          throw new TRPCError({
            code:
              error.code === "INVITATION_NOT_FOUND" ? "NOT_FOUND" : "BAD_REQUEST",
            message: error.message,
            cause: { reason: error.code }
          });
        }
        if (error instanceof OwnershipTransferRequiredError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: error.message,
            cause: { reason: error.code }
          });
        }
        if (error instanceof MealNameCollisionError) {
          throw new TRPCError({
            code: "CONFLICT",
            message: error.message,
            cause: {
              reason: error.code,
              collidingNames: [...error.collidingNames]
            }
          });
        }
        throw error;
      }
    }),

  revokeInvitation: householdOwnerProcedure
    .input(revokeInvitationSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        await revokeHouseholdInvitation(
          ctx.user.id,
          ctx.household.id,
          input.invitationId
        );
        revalidatePath("/settings");
        return { ok: true as const };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error.";
        if (message.toLowerCase().includes("not found")) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message,
            cause: { reason: "NOT_FOUND" }
          });
        }
        throw error;
      }
    }),

  /**
   * Round 15.5 Task 2 — user-initiated leave. Member-scoped, not
   * owner-only — anyone can leave. Sole owners of a multi-member
   * household get `SOLE_OWNER` and must transfer first (UI for that
   * is still parking-lot).
   */
  leaveHousehold: householdMemberProcedure
    .use(rateLimit("mutation"))
    .mutation(async ({ ctx }) => {
      try {
        const result = await leaveCurrentHousehold(
          ctx.user.id,
          ctx.household.id
        );
        revalidatePath("/settings");
        revalidatePath("/home");
        return {
          householdId: result.householdId,
          householdName: result.householdName
        };
      } catch (error) {
        if (error instanceof SoleOwnerCannotLeaveError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: error.message,
            cause: { reason: "SOLE_OWNER" }
          });
        }
        if (error instanceof NotMemberError) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
            cause: { reason: "NOT_MEMBER" }
          });
        }
        throw error;
      }
    }),

  removeMember: householdOwnerProcedure
    .use(rateLimit("mutation"))
    .input(removeMemberSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await removeMemberFromHousehold(
          ctx.user.id,
          input.targetUserId,
          ctx.household.id
        );

        void createNotification({
          userId: result.removedUserId,
          type: "system",
          title: `You were removed from ${result.householdName}`,
          body:
            "You'll land in a fresh personal kitchen the next time you sign in.",
          href: "/home"
        }).catch((error) => {
          logger.warn("removal_notification_failed", {
            actorId: ctx.user.id,
            removedUserId: result.removedUserId,
            error: error instanceof Error ? error.message : String(error)
          });
        });

        void dispatchTransactionalEmail({
          template: "household_member_removed",
          toEmail: result.removedUserEmail,
          toName: result.removedUserName,
          userId: result.removedUserId,
          removal: { householdName: result.householdName }
        }).catch((error) => {
          logger.warn("removal_email_dispatch_failed", {
            actorId: ctx.user.id,
            removedUserId: result.removedUserId,
            error: error instanceof Error ? error.message : String(error)
          });
        });

        revalidatePath("/settings");
        revalidatePath("/home");
        revalidatePath("/library");
        return { removedUserName: result.removedUserName };
      } catch (error) {
        if (error instanceof NotHouseholdOwnerError) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: error.message,
            cause: { reason: "NOT_OWNER" }
          });
        }
        if (
          error instanceof CannotRemoveSelfError ||
          error instanceof CannotRemoveOwnerError ||
          error instanceof NotMemberError
        ) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: error.message,
            cause: { reason: error.code }
          });
        }
        throw error;
      }
    })
});
