import "server-only";

import { revalidatePath } from "next/cache";
import { TRPCError } from "@trpc/server";
import { differenceInCalendarDays } from "date-fns";
import { eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { mealLogs, users } from "@/db/schema";
import {
  dispatchTransactionalEmail,
  type TransactionalTemplate
} from "@/lib/email/transactional";
import { FEATURE_KEYS, FEATURE_REGISTRY, isFeatureKey } from "@eeatly/api/gates/registry";
import { GATE_RULES } from "@eeatly/api/gates/rules";
import { logger } from "@/lib/observability/logger";
import { trackEvent } from "@/lib/observability/analytics";
import { betaCohortValues } from "@eeatly/api/validators/beta-cohort";
import {
  createOverride,
  deleteOverride,
  listFeaturesWithCounts,
  listOverridesForFeature,
  searchUsersForOverride
} from "@/services/feature-overrides";
import { updateUserBetaCohort } from "@/services/user-lifecycle";
import { adminProcedure, router } from "../trpc";

/**
 * Round 11 — admin reads. `featureRegistry` is the static catalog
 * (keys + defaults + descriptions); `featuresWithCounts` is the
 * dynamic per-feature override count for the admin index page.
 * `overridesForFeature` powers the per-feature detail page.
 * `userSearch` is the typeahead the override-create dialog uses.
 *
 * Mobile note: web admin still enforces the
 * `PLATFORM_ADMIN_HOST` host check in the route layout; the tRPC
 * `adminProcedure` only checks the role. That trade-off is
 * deliberate so the mobile-API surface can still reach admin
 * procedures off-subdomain.
 */
export const adminRouter = router({
  featureRegistry: adminProcedure.query(() => ({
    keys: FEATURE_KEYS,
    entries: Object.fromEntries(
      FEATURE_KEYS.map((key) => [
        key,
        {
          description: FEATURE_REGISTRY[key].description,
          defaultRule: FEATURE_REGISTRY[key].defaultRule
        }
      ])
    ) as Record<
      (typeof FEATURE_KEYS)[number],
      { description: string; defaultRule: (typeof FEATURE_REGISTRY)[keyof typeof FEATURE_REGISTRY]["defaultRule"] }
    >
  })),

  featuresWithCounts: adminProcedure.query(() => listFeaturesWithCounts()),

  overridesForFeature: adminProcedure
    .input(
      z.object({
        feature: z.string().refine(isFeatureKey, "Unknown feature key.")
      })
    )
    .query(({ input }) => {
      // refine narrows at runtime but TS still sees `string` — the
      // `isFeatureKey` predicate is the source of truth.
      if (!isFeatureKey(input.feature)) {
        throw new Error("Unknown feature key.");
      }
      return listOverridesForFeature(input.feature);
    }),

  userSearch: adminProcedure
    .input(
      z.object({
        q: z.string().trim().min(1).max(120),
        limit: z.number().int().min(1).max(50).optional()
      })
    )
    .query(({ input }) => searchUsersForOverride(input.q, input.limit)),

  /**
   * Round 11 — admin mutation surface. The legacy actions used
   * FormData; we accept JSON via tRPC. Same auth (admin role), same
   * revalidation paths.
   */
  createGateOverride: adminProcedure
    .input(
      z
        .object({
          feature: z.string().refine(isFeatureKey, "Unknown feature key."),
          ruleOverride: z.enum(GATE_RULES),
          userId: z.string().min(1).max(128).optional(),
          cohort: z.string().min(1).max(128).optional()
        })
        .refine(
          (v) => Boolean(v.userId) !== Boolean(v.cohort),
          { message: "Provide exactly one of userId or cohort." }
        )
    )
    .mutation(async ({ ctx, input }) => {
      // refine narrows the type for us at runtime; assert at the
      // service boundary.
      if (!isFeatureKey(input.feature)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unknown feature key."
        });
      }
      try {
        const created = await createOverride({
          feature: input.feature,
          ruleOverride: input.ruleOverride,
          userId: input.userId,
          cohort: input.cohort,
          createdByUserId: ctx.user.id
        });
        revalidatePath("/admin/features");
        revalidatePath(`/admin/features/${input.feature}`);
        return { id: created.id };
      } catch (error) {
        logger.warn("trpc_feature_override_create_failed", {
          adminId: ctx.user.id,
          error: error instanceof Error ? error.message : String(error)
        });
        throw error;
      }
    }),

  deleteGateOverride: adminProcedure
    .input(z.object({ overrideId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await deleteOverride({
          id: input.overrideId,
          deletedByUserId: ctx.user.id
        });
        revalidatePath("/admin/features");
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
   * Beta-ops procedures (formerly /admin/users formdata actions). The
   * cohort enum mirrors `betaCohortValues`; passing `null` clears.
   */
  updateBetaCohort: adminProcedure
    .input(
      z.object({
        userId: z.string().min(1).max(128),
        cohort: z.enum(betaCohortValues).nullable()
      })
    )
    .mutation(async ({ input }) => {
      await updateUserBetaCohort(input.userId, input.cohort);
      revalidatePath("/admin/users");
      logger.info("admin_beta_cohort_updated", {
        userId: input.userId,
        cohort: input.cohort
      });
      return { ok: true as const };
    }),

  dispatchLifecycleEmail: adminProcedure
    .input(
      z.object({
        userId: z.string().min(1).max(128),
        template: z.enum([
          "welcome",
          "first_meal_encouragement",
          "inactive_reminder",
          "weekly_recap_placeholder"
        ] as const satisfies Readonly<TransactionalTemplate[]>),
        recapTeaser: z.string().max(240).optional()
      })
    )
    .mutation(async ({ input }) => {
      const [user] = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name
        })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found.",
          cause: { reason: "NOT_FOUND" }
        });
      }

      let daysQuiet: number | null = null;
      if (input.template === "inactive_reminder") {
        const [row] = await db
          .select({ lastAt: max(mealLogs.createdAt) })
          .from(mealLogs)
          .where(eq(mealLogs.cookedByUserId, input.userId));
        const last = row?.lastAt ?? null;
        daysQuiet = last ? differenceInCalendarDays(new Date(), last) : null;
      }

      const recapTeaser =
        input.template === "weekly_recap_placeholder" && input.recapTeaser?.trim()
          ? input.recapTeaser.trim()
          : undefined;

      const result = await dispatchTransactionalEmail({
        template: input.template,
        toEmail: user.email,
        toName:
          user.name?.trim() || user.email.split("@")[0] || "eeatly friend",
        userId: input.userId,
        daysQuiet,
        recapTeaser,
        trackDispatch: true
      });

      revalidatePath("/admin/users");
      logger.info("admin_lifecycle_email_dispatched", {
        userId: input.userId,
        template: input.template,
        skipped: result.skipped,
        detail: result.detail
      });
      return { skipped: result.skipped, detail: result.detail };
    }),

  trackReminderPlaceholder: adminProcedure
    .input(
      z.object({
        userId: z.string().min(1).max(128),
        event: z.enum([
          "reminder_email_open_placeholder",
          "reminder_email_clicked_placeholder"
        ])
      })
    )
    .mutation(async ({ input }) => {
      trackEvent({
        name: input.event,
        userId: input.userId,
        metadata: { source: "admin_manual" }
      });
      logger.info(`admin_${input.event}`, { userId: input.userId });
      return { ok: true as const };
    })
});
