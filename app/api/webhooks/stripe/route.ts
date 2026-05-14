import { getServerEnv, hasStripeEnv } from "@/lib/env/server";
import { logger } from "@/lib/observability/logger";
import { getStripeClient } from "@/lib/stripe/client";
import { ingestStripeEvent } from "@/services/billing";

export const runtime = "nodejs";

/**
 * Stripe webhook receiver. Configure `STRIPE_WEBHOOK_SECRET` in env and
 * point the Stripe dashboard to `https://<host>/api/webhooks/stripe`.
 * Local dev: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
 * — the CLI prints a temporary secret to set in `.env.local`.
 *
 * Order of operations matters:
 *   1. Read the raw body — Stripe signs the raw bytes, not the parsed
 *      JSON. Using request.text() preserves byte fidelity.
 *   2. Verify the signature with `stripe.webhooks.constructEvent` BEFORE
 *      touching anything else. A failed signature ≠ a 5xx; return 401
 *      so Stripe doesn't retry an attacker's malformed payload.
 *   3. Hand off to `ingestStripeEvent` which writes the receipt row,
 *      runs the handler, and updates the receipt with success or error.
 *      Errors propagate as 500 so Stripe retries — that's the point of
 *      the receipt idempotency.
 */
export async function POST(request: Request) {
  let env: ReturnType<typeof getServerEnv>;
  try {
    env = getServerEnv();
  } catch (error) {
    logger.error("stripe_webhook_env_invalid", {
      detail: error instanceof Error ? error.message : "unknown"
    });
    return Response.json({ error: "Server misconfigured" }, { status: 500 });
  }

  if (!hasStripeEnv(env) || !env.STRIPE_WEBHOOK_SECRET) {
    return Response.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    logger.warn("stripe_webhook_missing_signature", {});
    return Response.json({ error: "Missing signature" }, { status: 400 });
  }

  let payloadRaw: string;
  try {
    payloadRaw = await request.text();
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  const stripe = getStripeClient();
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      payloadRaw,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch (error) {
    // Wrong signature = either a misconfigured secret or an attacker.
    // Either way, 401 — don't tell Stripe to retry.
    logger.warn("stripe_webhook_verify_failed", {
      detail: error instanceof Error ? error.message : "unknown"
    });
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  try {
    await ingestStripeEvent(event);
    return Response.json({ received: true });
  } catch (error) {
    // Handler error — 500 so Stripe retries with exponential backoff.
    // The receipt row is already in the DB with the error message; the
    // replay path checks for it before re-running.
    logger.error("stripe_webhook_ingest_failed", {
      eventId: event.id,
      eventType: event.type,
      detail: error instanceof Error ? error.message : "unknown"
    });
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
