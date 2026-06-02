import "server-only";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead
} from "@/services/notifications";
import { protectedProcedure, router } from "../trpc";

/**
 * Round 11 — notifications. The bell polls `list` on open; mutations
 * (mark-as-read, mark-all-read) move under Task 3.
 */
export const notificationsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          onlyUnread: z.boolean().optional(),
          limit: z.number().int().min(1).max(100).optional()
        })
        .optional()
    )
    .query(({ ctx, input }) => listNotificationsForUser(ctx.user.id, input)),

  markRead: protectedProcedure
    .input(z.object({ notificationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await markNotificationRead(ctx.user.id, input.notificationId);
      revalidatePath("/home");
      return { ok: true as const };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const updated = await markAllNotificationsRead(ctx.user.id);
    revalidatePath("/home");
    return { updated };
  })
});
