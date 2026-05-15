import "server-only";

import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { getServerEnv, hasStripeEnv } from "@/lib/env/server";
import {
  BillingNotConfiguredError,
  NoStripeCustomerError
} from "@/lib/errors/billing";
import { logger } from "@/lib/observability/logger";
import { getStripeClient } from "@/lib/stripe/client";
import {
  stripeWebhookReceipts,
  subscriptions,
  users
} from "@/db/schema";

/**
 * Round 6 — Stripe billing service. Public entry points:
 *   - createCheckoutSession   (action layer)
 *   - createPortalSession     (action layer)
 *   - getSubscriptionState    (read; UI surfaces)
 *   - ingestStripeEvent       (webhook handler)
 *
 * The webhook handler is the ONLY writer for the `subscriptions` table
 * + the denormalized columns on `users`. Action-layer writes (checkout,
 * portal) hit Stripe; Stripe sends the webhook back, the handler writes.
 * One-way data flow keeps the cached `users.subscriptionStatus` truthful.
 */

const SUPPORTED_STATUSES = [
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "incomplete_expired",
  "trialing",
  "unpaid"
] as const;
type SupportedStatus = (typeof SUPPORTED_STATUSES)[number];

function coerceStatus(raw: string): SupportedStatus | null {
  return (SUPPORTED_STATUSES as readonly string[]).includes(raw)
    ? (raw as SupportedStatus)
    : null;
}

export type SubscriptionState = {
  status: SupportedStatus;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  priceId: string | null;
};

/**
 * Read-only — UI surfaces use this for the Settings billing card +
 * the pricing-page CTA state. Returns null when the user has no Stripe
 * subscription at all (free plan).
 */
export async function getSubscriptionState(args: {
  userId: string;
}): Promise<SubscriptionState | null> {
  const [user] = await db
    .select({
      status: users.subscriptionStatus,
      currentPeriodEnd: users.subscriptionCurrentPeriodEnd
    })
    .from(users)
    .where(eq(users.id, args.userId))
    .limit(1);
  if (!user || !user.status) return null;

  // We need cancelAtPeriodEnd + priceId for the Settings copy ("ends
  // <date>" vs "renews <date>"). They live on the `subscriptions` row
  // only; a single lookup keyed by userId.
  const [sub] = await db
    .select({
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      priceId: subscriptions.priceId
    })
    .from(subscriptions)
    .where(eq(subscriptions.userId, args.userId))
    .limit(1);

  return {
    status: user.status,
    currentPeriodEnd: user.currentPeriodEnd,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    priceId: sub?.priceId ?? null
  };
}

async function getOrCreateStripeCustomerId(args: {
  userId: string;
  email: string;
  name: string;
}): Promise<string> {
  const [user] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, args.userId))
    .limit(1);
  if (user?.stripeCustomerId) return user.stripeCustomerId;

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: args.email,
    name: args.name,
    // metadata.userId is the durable backlink — webhook event payloads
    // include it on subsequent customer/subscription events, so we can
    // reconcile if the local DB is rebuilt or migrated.
    metadata: { userId: args.userId }
  });

  await db
    .update(users)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(eq(users.id, args.userId));

  logger.info("stripe_customer_created", {
    userId: args.userId,
    stripeCustomerId: customer.id
  });

  return customer.id;
}

export async function createCheckoutSession(args: {
  userId: string;
  userEmail: string;
  userName: string;
  priceType: "monthly" | "annual";
}): Promise<{ url: string }> {
  const env = getServerEnv();
  if (!hasStripeEnv(env)) {
    throw new BillingNotConfiguredError();
  }

  const priceId =
    args.priceType === "monthly" ? env.STRIPE_PRICE_MONTHLY : env.STRIPE_PRICE_ANNUAL;
  if (!priceId) throw new BillingNotConfiguredError();

  const stripeCustomerId = await getOrCreateStripeCustomerId({
    userId: args.userId,
    email: args.userEmail,
    name: args.userName
  });

  const stripe = getStripeClient();
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [{ price: priceId, quantity: 1 }],
    // client_reference_id + metadata.userId give us two redundant
    // backlinks. The webhook handler reads either; one belt-and-suspenders.
    client_reference_id: args.userId,
    metadata: { userId: args.userId },
    subscription_data: {
      metadata: { userId: args.userId }
    },
    success_url: `${base}/settings?upgraded=true`,
    cancel_url: `${base}/pricing?canceled=true`,
    allow_promotion_codes: true
  });

  if (!session.url) {
    throw new Error("Stripe didn't return a checkout URL.");
  }
  logger.info("stripe_checkout_session_created", {
    userId: args.userId,
    sessionId: session.id,
    priceType: args.priceType
  });
  return { url: session.url };
}

export async function createPortalSession(args: {
  userId: string;
}): Promise<{ url: string }> {
  const env = getServerEnv();
  if (!hasStripeEnv(env)) {
    throw new BillingNotConfiguredError();
  }

  const [user] = await db
    .select({ stripeCustomerId: users.stripeCustomerId })
    .from(users)
    .where(eq(users.id, args.userId))
    .limit(1);
  if (!user?.stripeCustomerId) {
    throw new NoStripeCustomerError();
  }

  const stripe = getStripeClient();
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${base}/settings`
  });

  return { url: session.url };
}

/**
 * Webhook ingest. Idempotent by Stripe event id (the receipt row is the
 * lock). Recognized events update both `subscriptions` and `users.*` in
 * one transaction so the denormalization can't drift.
 *
 * Unknown event types are logged and recorded as processed (so Stripe
 * doesn't retry forever) — no business impact, the data we care about
 * arrives on the subset we explicitly handle.
 */
export async function ingestStripeEvent(event: Stripe.Event): Promise<void> {
  // Idempotency check + receipt row. INSERT … ON CONFLICT lets the same
  // event arrive twice (Stripe retries on 5xx) without re-running the
  // handler.
  const inserted = await db
    .insert(stripeWebhookReceipts)
    .values({
      id: event.id,
      eventType: event.type,
      payload: event as unknown as Record<string, unknown>
    })
    .onConflictDoNothing({ target: stripeWebhookReceipts.id })
    .returning({ id: stripeWebhookReceipts.id });

  if (inserted.length === 0) {
    logger.info("stripe_webhook_replay_skipped", {
      eventId: event.id,
      eventType: event.type
    });
    return;
  }

  try {
    await processStripeEvent(event);
    await db
      .update(stripeWebhookReceipts)
      .set({ processedAt: new Date() })
      .where(eq(stripeWebhookReceipts.id, event.id));
    logger.info("stripe_webhook_processed", {
      eventId: event.id,
      eventType: event.type
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(stripeWebhookReceipts)
      .set({ error: message })
      .where(eq(stripeWebhookReceipts.id, event.id));
    logger.error("stripe_webhook_handler_failed", {
      eventId: event.id,
      eventType: event.type,
      error: message
    });
    throw error;
  }
}

async function processStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId =
        (session.metadata?.userId as string | undefined) ?? session.client_reference_id;
      if (!userId) {
        logger.warn("stripe_checkout_completed_missing_user", {
          sessionId: session.id
        });
        return;
      }
      // Subscription fields might not be populated yet; the followup
      // `customer.subscription.created` event carries the canonical
      // row. Just ensure the customer link is recorded.
      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id ?? null;
      if (customerId) {
        await db
          .update(users)
          .set({ stripeCustomerId: customerId, updatedAt: new Date() })
          .where(eq(users.id, userId));
      }
      return;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await upsertSubscriptionFromStripe(event.data.object as Stripe.Subscription);
      return;
    case "invoice.payment_succeeded":
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      // Subscriptions go from `incomplete` → `active` on first payment;
      // `active` → `past_due` on failed renewal. Stripe also sends a
      // `customer.subscription.updated` after these — we let that be the
      // source of truth and just log here for visibility.
      logger.info("stripe_invoice_event", {
        eventType: event.type,
        invoiceId: invoice.id,
        customerId: typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id
      });
      return;
    }
    default:
      logger.info("stripe_webhook_unhandled_event", { eventType: event.type });
  }
}

async function upsertSubscriptionFromStripe(
  sub: Stripe.Subscription
): Promise<void> {
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const userIdFromMetadata = sub.metadata?.userId as string | undefined;

  // Resolve userId — metadata is the primary path; fall back to the
  // existing user row keyed by stripeCustomerId.
  let userId = userIdFromMetadata ?? null;
  if (!userId) {
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.stripeCustomerId, customerId))
      .limit(1);
    userId = row?.id ?? null;
  }
  if (!userId) {
    logger.warn("stripe_subscription_unresolved_user", {
      subscriptionId: sub.id,
      customerId
    });
    return;
  }

  const status = coerceStatus(sub.status);
  if (!status) {
    logger.warn("stripe_subscription_unknown_status", {
      subscriptionId: sub.id,
      status: sub.status
    });
    return;
  }

  // Subscription's `current_period_end` and `current_period_start` live
  // on the first subscription item in the dahlia API version. We treat
  // a missing value as null and let the next event correct.
  const item = sub.items?.data?.[0];
  const currentPeriodStart =
    item?.current_period_start != null ? new Date(item.current_period_start * 1000) : null;
  const currentPeriodEnd =
    item?.current_period_end != null ? new Date(item.current_period_end * 1000) : null;
  const priceId = item?.price?.id ?? null;

  // One transaction: write `subscriptions` row + denormalize to `users`.
  await db.transaction(async (tx) => {
    // ON CONFLICT (stripeCustomerId) DO UPDATE … keeps each customer to
    // one row. The unique constraint is what enables this upsert shape.
    await tx
      .insert(subscriptions)
      .values({
        userId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: sub.id,
        status,
        priceId,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
        updatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: subscriptions.stripeCustomerId,
        set: {
          stripeSubscriptionId: sub.id,
          status,
          priceId,
          currentPeriodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          updatedAt: new Date()
        }
      });

    await tx
      .update(users)
      .set({
        stripeCustomerId: customerId,
        subscriptionStatus: status,
        subscriptionCurrentPeriodEnd: currentPeriodEnd,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  });
}

// Re-export typed errors so callers don't need to know lib/errors/billing.
export { BillingNotConfiguredError, NoStripeCustomerError };
