import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  BillingNotConfiguredError,
  NoStripeCustomerError
} from "@/lib/errors/billing";
import { logger } from "@/lib/observability/logger";
import {
  createCheckoutSession,
  createPortalSession,
  getSubscriptionState
} from "@/services/billing";
import { getStripeCatalog, perMonthDisplay } from "@/services/stripe-catalog";
import { getTierStatus } from "@/services/ai-credits";
import { MONTHLY_CREDIT_GRANT, TIERS } from "@/lib/pricing";
import { protectedProcedure, rateLimit, router } from "../trpc";

function tierDisplay(
  tier: "plus" | "premium" | "pro",
  tp: import("@/services/stripe-catalog").TierPrices
) {
  const t = TIERS[tier];
  return {
    // `sellable` = a real Stripe price exists (checkout works). Display always
    // falls back to the TIERS amounts so prices never render blank pre-Stripe.
    sellable: Boolean(tp.monthly || tp.annual),
    monthly: { display: tp.monthly?.display ?? t.monthly.display },
    annual: {
      display: tp.annual?.display ?? t.annual.display,
      perMonthDisplay: tp.annual ? perMonthDisplay(tp.annual) : t.annual.perMonthDisplay
    }
  };
}

/**
 * Round 11 — billing.
 *
 * `currentSubscription` returns the user's snapshot (status, period
 * end, cancel flag, Stripe price id). Per-user scope, no household
 * needed.
 *
 * `createCheckoutSession` / `createPortalSession` return Stripe URLs;
 * the client does `window.location.assign(url)` so the Stripe-hosted
 * page replaces the current tab.
 *
 * Both URL-producing procedures map `BillingNotConfiguredError` and
 * `NoStripeCustomerError` to structured causes so the UI can render
 * the right message (legacy free user vs misconfigured env).
 */
export const billingRouter = router({
  currentSubscription: protectedProcedure.query(({ ctx }) =>
    getSubscriptionState({ userId: ctx.user.id })
  ),

  /**
   * Effective tier + no-card trial snapshot. Unlike `currentSubscription`
   * (raw Stripe state), this folds in the 14-day first-time Pro trial — so
   * a trial user reads as `tier: "pro"` with `onTrial: true`.
   */
  tierStatus: protectedProcedure.query(({ ctx }) => getTierStatus(ctx.user.id)),

  /** Live tier prices (from the Stripe catalog) + included monthly credits. */
  catalog: protectedProcedure.query(async () => {
    const catalog = await getStripeCatalog();
    return {
      plus: {
        ...tierDisplay("plus", catalog.tiers.plus),
        monthlyCredits: MONTHLY_CREDIT_GRANT.plus
      },
      premium: {
        ...tierDisplay("premium", catalog.tiers.premium),
        monthlyCredits: MONTHLY_CREDIT_GRANT.premium
      },
      pro: {
        ...tierDisplay("pro", catalog.tiers.pro),
        monthlyCredits: MONTHLY_CREDIT_GRANT.pro
      }
    };
  }),

  createCheckoutSession: protectedProcedure
    .use(rateLimit("mutation"))
    .input(
      z.object({
        tier: z.enum(["plus", "premium", "pro"]).default("plus"),
        interval: z.enum(["monthly", "annual"])
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createCheckoutSession({
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
          tier: input.tier,
          interval: input.interval
        });
      } catch (error) {
        if (error instanceof BillingNotConfiguredError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: error.message,
            cause: { reason: "BILLING_NOT_CONFIGURED" }
          });
        }
        logger.warn("trpc_billing_checkout_failed", {
          userId: ctx.user.id,
          error: error instanceof Error ? error.message : String(error)
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Couldn't start checkout. Please try again."
        });
      }
    }),

  createPortalSession: protectedProcedure
    .use(rateLimit("mutation"))
    .mutation(async ({ ctx }) => {
      try {
        return await createPortalSession({ userId: ctx.user.id });
      } catch (error) {
        if (error instanceof BillingNotConfiguredError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: error.message,
            cause: { reason: "BILLING_NOT_CONFIGURED" }
          });
        }
        if (error instanceof NoStripeCustomerError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: error.message,
            cause: { reason: "NO_STRIPE_CUSTOMER" }
          });
        }
        logger.warn("trpc_billing_portal_failed", {
          userId: ctx.user.id,
          error: error instanceof Error ? error.message : String(error)
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Couldn't open billing portal. Please try again."
        });
      }
    })
});
