import { describe, expect, it } from "vitest";
import { isLaunchFreeAccess, type ServerEnv } from "./server";

// Minimal env factory — only the fields `isLaunchFreeAccess` /
// `hasStripeEnv` consult matter; the rest are filled to satisfy the type.
function makeEnv(over: Partial<ServerEnv>): ServerEnv {
  return {
    DATABASE_URL: "postgres://localhost/db",
    BETTER_AUTH_SECRET: "x".repeat(32),
    BETTER_AUTH_URL: "https://example.com",
    NEXT_PUBLIC_APP_URL: "https://example.com",
    UPSTASH_REDIS_REST_URL: "https://redis.example.com",
    UPSTASH_REDIS_REST_TOKEN: "token",
    ANTHROPIC_API_KEY: "key",
    OPENAI_API_KEY: "key",
    ...over
  } as ServerEnv;
}

// The sellable catalog is synced from Stripe (not env) — the core trio is
// all `hasStripeEnv` needs now.
const FULL_STRIPE: Partial<ServerEnv> = {
  STRIPE_SECRET_KEY: "sk",
  STRIPE_PUBLISHABLE_KEY: "pk",
  STRIPE_WEBHOOK_SECRET: "whsec"
};

describe("isLaunchFreeAccess", () => {
  it("is ON by default when Stripe is not configured", () => {
    expect(isLaunchFreeAccess(makeEnv({}))).toBe(true);
  });

  it("is OFF (checkout path) when Stripe is fully configured", () => {
    expect(isLaunchFreeAccess(makeEnv(FULL_STRIPE))).toBe(false);
  });

  it("LAUNCH_FREE_ACCESS=false force-disables the promo even without Stripe", () => {
    expect(isLaunchFreeAccess(makeEnv({ LAUNCH_FREE_ACCESS: "false" }))).toBe(false);
  });

  it("LAUNCH_FREE_ACCESS=true force-enables the promo even with Stripe configured", () => {
    expect(
      isLaunchFreeAccess(makeEnv({ ...FULL_STRIPE, LAUNCH_FREE_ACCESS: "true" }))
    ).toBe(true);
  });
});
