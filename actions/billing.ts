"use server";

import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";
import { checkMealMutationLimit } from "@/lib/security/rate-limit";
import {
  BillingNotConfiguredError,
  NoStripeCustomerError
} from "@/lib/errors/billing";
import {
  createCheckoutSession,
  createPortalSession
} from "@/services/billing";

const checkoutSchema = z.object({
  priceType: z.enum(["monthly", "annual"])
});

export type CreateCheckoutResult =
  | { ok: true; url: string }
  | {
      ok: false;
      code: "VALIDATION" | "RATE_LIMITED" | "BILLING_NOT_CONFIGURED" | "ERROR";
      message: string;
    };

export async function createCheckoutSessionAction(input: {
  priceType: "monthly" | "annual";
}): Promise<CreateCheckoutResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid checkout request."
    };
  }

  const user = await requireCurrentUser();
  try {
    await checkMealMutationLimit(user.id);
  } catch {
    return { ok: false, code: "RATE_LIMITED", message: "Too many requests." };
  }

  try {
    const result = await createCheckoutSession({
      userId: user.id,
      userEmail: user.email,
      userName: user.name,
      priceType: parsed.data.priceType
    });
    return { ok: true, url: result.url };
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) {
      return { ok: false, code: error.code, message: error.message };
    }
    const message = error instanceof Error ? error.message : "Couldn't start checkout.";
    logger.warn("billing_checkout_failed", { userId: user.id, error: message });
    return { ok: false, code: "ERROR", message: "Couldn't start checkout. Please try again." };
  }
}

export type CreatePortalResult =
  | { ok: true; url: string }
  | {
      ok: false;
      code:
        | "RATE_LIMITED"
        | "BILLING_NOT_CONFIGURED"
        | "NO_STRIPE_CUSTOMER"
        | "ERROR";
      message: string;
    };

export async function createPortalSessionAction(): Promise<CreatePortalResult> {
  const user = await requireCurrentUser();
  try {
    await checkMealMutationLimit(user.id);
  } catch {
    return { ok: false, code: "RATE_LIMITED", message: "Too many requests." };
  }

  try {
    const result = await createPortalSession({ userId: user.id });
    return { ok: true, url: result.url };
  } catch (error) {
    if (error instanceof BillingNotConfiguredError) {
      return { ok: false, code: error.code, message: error.message };
    }
    if (error instanceof NoStripeCustomerError) {
      return { ok: false, code: error.code, message: error.message };
    }
    const message = error instanceof Error ? error.message : "Couldn't open billing portal.";
    logger.warn("billing_portal_failed", { userId: user.id, error: message });
    return {
      ok: false,
      code: "ERROR",
      message: "Couldn't open billing portal. Please try again."
    };
  }
}
