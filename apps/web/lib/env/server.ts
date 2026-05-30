import "server-only";

import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional()
);

const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional()
);

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid Postgres connection URL."),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters."),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid app origin."),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid app origin."),
  PLATFORM_ADMIN_HOST: optionalString,
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: optionalString,
  RESEND_WEBHOOK_SECRET: optionalString,
  R2_ACCOUNT_ID: optionalString,
  R2_ACCESS_KEY_ID: optionalString,
  R2_SECRET_ACCESS_KEY: optionalString,
  R2_BUCKET: optionalString,
  R2_PUBLIC_BASE_URL: optionalUrl,
  UPSTASH_REDIS_REST_URL: z.string().url("UPSTASH_REDIS_REST_URL must be a valid URL."),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1, "UPSTASH_REDIS_REST_TOKEN is required."),
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required."),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required."),
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  CRON_SECRET: optionalString,
  // Round 6 — Stripe paid tier. Optional individually (all-or-none
  // enforced via `hasStripeEnv` below); the pricing page surfaces
  // "Coming soon" when missing instead of crashing.
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_PUBLISHABLE_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_PRICE_MONTHLY: optionalString,
  STRIPE_PRICE_ANNUAL: optionalString,
  // Note: display prices are NOT env-driven — they live in `lib/pricing.ts`
  // (the single source of truth) so the marketing + pricing pages render
  // real numbers even before Stripe is configured. When you create the
  // Stripe Prices, their amounts MUST match `PRICING` in that file.
  // Release-v1 launch promo. While we don't yet have Stripe wired (no LLC
  // / payments), Plus is unlocked for everyone, no card. Tri-state:
  // "true"/"false" force the behavior; unset defaults to ON until Stripe
  // is configured. See `isLaunchFreeAccess` below.
  LAUNCH_FREE_ACCESS: optionalString,
  // Sentry error tracking — all optional; the SDK is inert when the DSN
  // is absent (no network, no overhead), so local/dev/preview need none
  // of these. `SENTRY_AUTH_TOKEN` only enables source-map upload at build
  // time. The DSN is intentionally public (safe to expose to the client).
  SENTRY_DSN: optionalString,
  NEXT_PUBLIC_SENTRY_DSN: optionalString,
  SENTRY_AUTH_TOKEN: optionalString,
  SENTRY_ENVIRONMENT: optionalString,
  // PostHog product analytics — public, client-side. Inert without the
  // key. See also `lib/env/public.ts` (where the client reads them).
  NEXT_PUBLIC_POSTHOG_KEY: optionalString,
  NEXT_PUBLIC_POSTHOG_HOST: optionalString
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cachedEnv: ServerEnv | null = null;

export function getServerEnv() {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    const messages = result.error.issues.map((issue) => {
      const key = issue.path.join(".");
      return `${key}: ${issue.message}`;
    });

    throw new Error(`Invalid server environment:\n${messages.join("\n")}`);
  }

  cachedEnv = result.data;
  return cachedEnv;
}

export function hasR2Env(env = getServerEnv()) {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET &&
      env.R2_PUBLIC_BASE_URL
  );
}

export function hasGoogleAuthEnv(env = getServerEnv()) {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/**
 * All-or-none guard for the Stripe paid tier. Returns true only when
 * every required value is set. The pricing page checks this and shows
 * a "Coming soon" placeholder when false; billing actions throw a typed
 * `BillingNotConfiguredError` (Task 3) so callers can't accidentally
 * fall through to a half-wired Stripe path.
 *
 * `STRIPE_PUBLISHABLE_KEY` is technically client-safe (used in the
 * future for embedded checkout / pricing-table widgets) but it's
 * required here too — if you only have the secret half, you're
 * mid-configuration.
 */
export function hasStripeEnv(env = getServerEnv()) {
  return Boolean(
    env.STRIPE_SECRET_KEY &&
      env.STRIPE_PUBLISHABLE_KEY &&
      env.STRIPE_WEBHOOK_SECRET &&
      env.STRIPE_PRICE_MONTHLY &&
      env.STRIPE_PRICE_ANNUAL
  );
}

/**
 * Release-v1 launch promo: eeatly Plus is unlocked for everyone, no card
 * required, no expiry — framed on the pricing page as a launch discount.
 *
 * ON by default until Stripe is wired (`!hasStripeEnv`), so v1 needs no
 * new env var. Once `STRIPE_*` is configured the promo turns itself off
 * and real checkout takes over — no code change. `LAUNCH_FREE_ACCESS`
 * can force either side: "true" keeps the promo on even with Stripe set,
 * "false" is the kill-switch that restores gating immediately.
 */
export function isLaunchFreeAccess(env = getServerEnv()) {
  if (env.LAUNCH_FREE_ACCESS === "true") return true;
  if (env.LAUNCH_FREE_ACCESS === "false") return false;
  return !hasStripeEnv(env);
}

/**
 * True when a Sentry DSN is configured (server-side check). The SDK
 * itself no-ops when the DSN is empty, so this is mainly for deploy
 * reporting + skipping setup work; the Sentry config files read
 * `process.env` directly since they run before/around the app boundary.
 */
export function hasSentryEnv(env = getServerEnv()) {
  return Boolean(env.SENTRY_DSN || env.NEXT_PUBLIC_SENTRY_DSN);
}
