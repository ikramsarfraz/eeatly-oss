import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { BillingNotConfiguredError } from "@/lib/errors/billing";
import { logger } from "@/lib/observability/logger";
import { getCreditBalance } from "@/services/ai-credits";
import { createCreditCheckoutSession } from "@/services/billing";
import { getStripeCatalog } from "@/services/stripe-catalog";
import { AI_CREDIT_COSTS } from "@/lib/pricing";
import { protectedProcedure, rateLimit, router } from "../trpc";

/**
 * AI-credit metering surface for clients.
 *   - `balance`  — the user's current credits (monthly grant + top-ups),
 *                  refilled lazily on read.
 *   - `catalog`  — static pack + op-cost config for the buy UI.
 *   - `buy`      — opens a Stripe `payment`-mode Checkout for a top-up pack.
 */
export const creditsRouter = router({
  balance: protectedProcedure.query(({ ctx }) => getCreditBalance(ctx.user.id)),

  /** Top-up packs from the live Stripe catalog + the per-op credit costs. */
  catalog: protectedProcedure.query(async () => {
    const catalog = await getStripeCatalog();
    return {
      packs: catalog.packs.map((p) => ({
        priceId: p.priceId,
        credits: p.credits,
        amount: p.amount,
        display: p.display,
        label: `${p.credits.toLocaleString()} credits`
      })),
      costs: AI_CREDIT_COSTS
    };
  }),

  buy: protectedProcedure
    .use(rateLimit("mutation"))
    .input(z.object({ priceId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await createCreditCheckoutSession({
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
          priceId: input.priceId
        });
      } catch (error) {
        if (error instanceof BillingNotConfiguredError) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: error.message,
            cause: { reason: "BILLING_NOT_CONFIGURED" }
          });
        }
        logger.warn("trpc_credits_buy_failed", {
          userId: ctx.user.id,
          error: error instanceof Error ? error.message : String(error)
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Couldn't start checkout. Please try again."
        });
      }
    })
});
