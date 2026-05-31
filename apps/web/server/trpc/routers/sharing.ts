import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  canReshareItem,
  dismissTombstone,
  forkPlan,
  forkRecipe,
  grantItem,
  listActiveShareLinks,
  listConnections,
  listGrantsForItem,
  listSharedWithMe,
  listTombstones,
  requestItem,
  resolveRequest,
  revokeItem
} from "@/services/sharing";
import { getUserSettings, updateUserSettings } from "@/services/user-settings";
import { protectedProcedure, rateLimit, router } from "../trpc";

/**
 * Per-item sharing procedures (Phase 1 — the engine).
 *
 * User-scoped (not household-scoped): ownership is the item's creator and
 * access is per-person, so these run on `protectedProcedure`. Service-layer
 * checks enforce owner-only mutation and connection requirements; we map
 * thrown errors to a generic FORBIDDEN/NOT_FOUND here.
 */

const itemRefInput = z.object({
  itemType: z.enum(["recipe", "plan"]),
  itemId: z.string().uuid()
});

function mapError(error: unknown): TRPCError {
  if (error instanceof TRPCError) return error;
  const message = error instanceof Error ? error.message : "Sharing failed.";
  const lower = message.toLowerCase();
  if (lower.includes("not found")) {
    return new TRPCError({ code: "NOT_FOUND", message, cause: { reason: "ITEM_NOT_FOUND" } });
  }
  if (lower.includes("only the owner") || lower.includes("circle") || lower.includes("already own")) {
    return new TRPCError({ code: "FORBIDDEN", message, cause: { reason: "SHARE_FORBIDDEN" } });
  }
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
}

export const sharingRouter = router({
  /** Owner-side: who currently has access to this item. */
  grantsForItem: protectedProcedure.input(itemRefInput).query(async ({ ctx, input }) => {
    try {
      return await listGrantsForItem({
        userId: ctx.user.id,
        itemType: input.itemType,
        itemId: input.itemId
      });
    } catch (error) {
      throw mapError(error);
    }
  }),

  /** The viewer's sharing circle (people they can share with). */
  connections: protectedProcedure.query(({ ctx }) => listConnections(ctx.user.id)),

  /** Can the viewer re-share this item (granted + owner allows reshare)? */
  canReshare: protectedProcedure
    .input(itemRefInput)
    .query(({ ctx, input }) => canReshareItem(ctx.user.id, input.itemType, input.itemId)),

  /** Global sharing & privacy settings (Settings). */
  privacySettings: protectedProcedure.query(({ ctx }) => getUserSettings(ctx.user.id)),

  updatePrivacySettings: protectedProcedure
    .use(rateLimit("mutation"))
    .input(
      z.object({
        allowLinkShares: z.boolean().optional(),
        cooksCanReshare: z.boolean().optional(),
        whoCanAddYou: z.enum(["anyone", "connections", "no_one"]).optional(),
        findByEmail: z.boolean().optional(),
        measurementSystem: z.enum(["metric", "imperial"]).optional()
      })
    )
    .mutation(({ ctx, input }) => updateUserSettings(ctx.user.id, input)),

  /** Grantee-side: live copies others have shared with me. */
  sharedWithMe: protectedProcedure.query(({ ctx }) => listSharedWithMe(ctx.user.id)),

  /** The recipient's "Recently removed" tombstone strip. */
  tombstones: protectedProcedure.query(({ ctx }) => listTombstones(ctx.user.id)),

  /** Active "anyone with the link" recipe shares (Settings). */
  activeShareLinks: protectedProcedure.query(({ ctx }) => listActiveShareLinks(ctx.user.id)),

  /** Grant an item to a connected person (owner-only, idempotent). */
  grant: protectedProcedure
    .use(rateLimit("mutation"))
    .input(itemRefInput.extend({ granteeUserId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await grantItem({
          ownerUserId: ctx.user.id,
          itemType: input.itemType,
          itemId: input.itemId,
          granteeUserId: input.granteeUserId
        });
      } catch (error) {
        throw mapError(error);
      }
    }),

  /** Revoke a person's access (owner-only, writes a tombstone). */
  revoke: protectedProcedure
    .use(rateLimit("mutation"))
    .input(itemRefInput.extend({ granteeUserId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await revokeItem({
          ownerUserId: ctx.user.id,
          itemType: input.itemType,
          itemId: input.itemId,
          granteeUserId: input.granteeUserId
        });
        return { ok: true as const };
      } catch (error) {
        throw mapError(error);
      }
    }),

  /** Recipient asks the owner to share a (locked) item. */
  request: protectedProcedure
    .use(rateLimit("mutation"))
    .input(itemRefInput)
    .mutation(async ({ ctx, input }) => {
      try {
        return await requestItem({
          requesterUserId: ctx.user.id,
          itemType: input.itemType,
          itemId: input.itemId
        });
      } catch (error) {
        throw mapError(error);
      }
    }),

  /** Owner grants or declines a pending request. */
  resolveRequest: protectedProcedure
    .use(rateLimit("mutation"))
    .input(z.object({ requestId: z.string().uuid(), action: z.enum(["grant", "decline"]) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await resolveRequest({
          ownerUserId: ctx.user.id,
          requestId: input.requestId,
          action: input.action
        });
        return { ok: true as const };
      } catch (error) {
        throw mapError(error);
      }
    }),

  /** Save a copy (fork) of a shared recipe or plan into your own library. */
  saveCopy: protectedProcedure
    .use(rateLimit("mutation"))
    .input(itemRefInput)
    .mutation(async ({ ctx, input }) => {
      try {
        if (input.itemType === "plan") {
          const { newPlanId } = await forkPlan({
            forkerUserId: ctx.user.id,
            sourcePlanId: input.itemId
          });
          return { newItemId: newPlanId };
        }
        const { newMealId } = await forkRecipe({
          forkerUserId: ctx.user.id,
          sourceMealId: input.itemId
        });
        return { newItemId: newMealId };
      } catch (error) {
        throw mapError(error);
      }
    }),

  /** Dismiss a tombstone from the "Recently removed" strip. */
  dismissTombstone: protectedProcedure
    .use(rateLimit("mutation"))
    .input(z.object({ tombstoneId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await dismissTombstone(ctx.user.id, input.tombstoneId);
      return { ok: true as const };
    })
});
