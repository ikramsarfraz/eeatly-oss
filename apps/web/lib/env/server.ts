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
  // Separate human-readable display strings — kept out of the price IDs
  // so the marketing copy doesn't depend on a Stripe API call at render.
  STRIPE_PRICE_MONTHLY_DISPLAY: optionalString,
  STRIPE_PRICE_ANNUAL_DISPLAY: optionalString
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
