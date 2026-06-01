import "server-only";

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { BillingNotConfiguredError } from "@/lib/errors/billing";
import { logger } from "@/lib/observability/logger";
import { getCreditBalance } from "@/services/ai-credits";
import { createCreditCheckoutSession } from "@/services/billing";
import {
  AI_CREDIT_COSTS,
  TOPUP_PACKS,
  TOPUP_PACK_IDS,
  isTopupPackId
} from "@/lib/pricing";
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

  /** Static config for the credits UI — no auth-specific data. */
  catalog: protectedProcedure.query(() => ({
    packs: TOPUP_PACK_IDS.map((id) => TOPUP_PACKS[id]),
    costs: AI_CREDIT_COSTS
  })),

  buy: protectedProcedure
    .use(rateLimit("mutation"))
    .input(z.object({ packId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!isTopupPackId(input.packId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unknown credit pack.",
          cause: { reason: "INVALID_INPUT" }
        });
      }
      try {
        return await createCreditCheckoutSession({
          userId: ctx.user.id,
          userEmail: ctx.user.email,
          userName: ctx.user.name,
          packId: input.packId
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
