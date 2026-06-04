import "server-only";

import Stripe from "stripe";
import { getServerEnv, hasStripeEnv } from "@/lib/env/server";

/**
 * Round 6 — lazy Stripe client. Same pattern as Anthropic / OpenAI /
 * Resend clients elsewhere: no top-level instantiation so the SDK and
 * its config validation don't run at module load. `getStripeClient`
 * throws if Stripe isn't fully configured — callers should pre-check
 * with `hasStripeEnv()` and surface a graceful "billing not configured"
 * path (the pricing page does this).
 */
let _client: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!_client) {
    const env = getServerEnv();
    if (!hasStripeEnv(env) || !env.STRIPE_SECRET_KEY) {
      throw new Error(
        "Stripe is not configured — missing STRIPE_SECRET_KEY or related env vars."
      );
    }
    _client = new Stripe(env.STRIPE_SECRET_KEY, {
      // Pin the API version so Stripe can't silently change response
      // shapes under us. The SDK type narrows this to the bundled
      // `LatestApiVersion`; bump when upgrading the SDK and running
      // integration tests against the new shapes.
      apiVersion: "2026-04-22.dahlia",
      // Don't blow up cold-start budgets on transient network issues —
      // Stripe's SDK retries with exponential backoff. The 7s primary
      // timeout we set for OpenAI doesn't apply here; webhook handlers
      // need a moment.
      timeout: 10_000
    });
  }
  return _client;
}

/**
 * Test-only reset for unit tests that mock the client at the module
 * boundary. NEVER call in production code.
 */
export function __resetStripeClientForTests() {
  _client = null;
}
