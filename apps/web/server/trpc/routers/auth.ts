import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { sanitizeCallbackURL } from "@/lib/auth/callback-url";
import { sendAccountDeletedEmail } from "@/lib/email/transactional";
import { logger } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/request-id";
import { deleteUserAccount } from "@/services/account";
import { userOwnsMultiMemberHousehold } from "@/services/households";
import { protectedProcedure, publicProcedure, rateLimit, router } from "../trpc";

const CONFIRMATION_PHRASE = "delete my account";

/**
 * Round 11 — auth-adjacent procedures.
 *
 * `signOutAndRedirect` is the Round 8 invite-email-mismatch helper:
 * sign out + return a safe redirect URL the client uses with
 * `window.location.assign` (so the freshly-cleared cookie state takes
 * effect). The URL is sanitized against open-redirect.
 *
 * `deleteAccount` keeps the Round 4 owner-block branch (account
 * deletion fails when the caller owns a multi-member household and
 * hasn't transferred ownership). The redirect that used to live at
 * the action layer happens in the calling component now — tRPC
 * procedures don't redirect.
 */
export const authRouter = router({
  /**
   * R32 — update the user's display name (Settings → Account edit form).
   * Email is intentionally NOT editable here: it's the sign-in + recovery
   * identity and must change through a deliberate, verified flow.
   */
  updateName: protectedProcedure
    .use(rateLimit("mutation"))
    .input(z.object({ name: z.string().trim().min(1, "Name can't be empty.").max(80) }))
    .mutation(async ({ ctx, input }) => {
      // Go through Better Auth's own API (not a raw Drizzle update) so the
      // write lands in the user table AND the cached session cookie is
      // refreshed — otherwise the 5-minute cookieCache keeps serving the old
      // name on reload, making the change look like it didn't persist.
      try {
        await auth.api.updateUser({ body: { name: input.name }, headers: ctx.headers });
      } catch (error) {
        logger.warn("account_update_name_failed", {
          userId: ctx.user.id,
          error: error instanceof Error ? error.message : String(error)
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Couldn't update your name. Please try again."
        });
      }
      return { name: input.name };
    }),

  signOutAndRedirect: publicProcedure
    .input(z.object({ redirectTo: z.string().min(1).max(2048) }))
    .mutation(async ({ ctx, input }) => {
      const safeRedirect = sanitizeCallbackURL(input.redirectTo);
      try {
        await auth.api.signOut({ headers: ctx.headers });
      } catch (error) {
        logger.warn("trpc_sign_out_and_redirect_failed", {
          error: error instanceof Error ? error.message : String(error)
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Couldn't sign you out. Please try again."
        });
      }
      return { redirectTo: safeRedirect };
    }),

  deleteAccount: protectedProcedure
    .use(rateLimit("mutation"))
    .input(z.object({ confirmationPhrase: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const normalized = input.confirmationPhrase.trim().toLowerCase();
      if (normalized !== CONFIRMATION_PHRASE) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Type "${CONFIRMATION_PHRASE}" exactly to confirm.`,
          cause: { reason: "CONFIRMATION_MISMATCH" }
        });
      }

      // Round 4 guard: owners of multi-member households can't be
      // deleted without first transferring ownership.
      if (await userOwnsMultiMemberHousehold(ctx.user.id)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Transfer household ownership before deleting your account.",
          cause: { reason: "OWNER_BLOCK" }
        });
      }

      const requestId = (await getRequestId()) ?? undefined;
      logger.info("account_delete_requested", {
        userId: ctx.user.id,
        requestId
      });

      // Confirmation email first — after the cascade tear-down, the
      // user's email + name no longer exist on the row.
      try {
        await sendAccountDeletedEmail(
          ctx.user.email,
          ctx.user.name ?? "there",
          ctx.user.id
        );
      } catch (error) {
        logger.warn("account_delete_confirmation_email_failed", {
          userId: ctx.user.id,
          requestId,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Sign out BEFORE deleting so the session is invalidated even if
      // the delete itself fails.
      try {
        await auth.api.signOut({ headers: ctx.headers });
      } catch (error) {
        logger.warn("account_delete_signout_failed", {
          userId: ctx.user.id,
          requestId,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      await deleteUserAccount(ctx.user.id);

      // Return the post-sign-out target. The caller navigates via
      // `window.location.assign` so the cookie clear takes effect.
      return { redirectTo: "/sign-in?deleted=1" };
    })
});
