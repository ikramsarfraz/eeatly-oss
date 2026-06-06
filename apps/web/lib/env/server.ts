import "server-only";

import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional()
);

// R2's public base URL must be the bucket's *public* origin — the r2.dev
// development subdomain (`https://pub-<hash>.r2.dev`) or a custom domain.
// The `<account>.r2.cloudflarestorage.com` host is the S3 *API* endpoint:
// it only answers SigV4-signed requests, so a browser GET of an uploaded
// object returns 400. Pointing R2_PUBLIC_BASE_URL there silently breaks
// every image (uploads succeed, displays 400), so reject it at boot with
// an actionable message instead.
const r2PublicBaseUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .string()
    .url()
    .refine(
      (value) => {
        try {
          return !new URL(value).hostname.endsWith(".r2.cloudflarestorage.com");
        } catch {
          return false;
        }
      },
      {
        message:
          "R2_PUBLIC_BASE_URL must be the bucket's public URL (https://pub-<hash>.r2.dev or a custom domain), not the S3 API endpoint (<account>.r2.cloudflarestorage.com)."
      }
    )
    .optional()
);

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid Postgres connection URL."),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters."),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL must be a valid app origin."),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL must be a valid app origin."),
  PLATFORM_ADMIN_HOST: optionalString,
  // Registrable domain the product is served on (e.g. "eeatly.com", or
  // "localtest.me" locally — it resolves *.localtest.me → 127.0.0.1). When
  // set, the platform-admin surface is reachable on the `admin.` subdomain
  // and the session cookie is shared across subdomains. Unset = single-origin
  // (no admin subdomain). See lib/auth/admin-host.ts.
  ROOT_DOMAIN: optionalString,
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: optionalString,
  // Verified sending domain (e.g. "eeatly.com"). When set, transactional
  // mail is sent from per-category aliases on this domain (hello@, billing@,
  // security@, …) with matching Reply-To. When unset, mail falls back to the
  // single EMAIL_FROM address — see lib/email/senders.ts.
  EMAIL_DOMAIN: optionalString,
  RESEND_WEBHOOK_SECRET: optionalString,
  R2_ACCOUNT_ID: optionalString,
  R2_ACCESS_KEY_ID: optionalString,
  R2_SECRET_ACCESS_KEY: optionalString,
  R2_BUCKET: optionalString,
  R2_PUBLIC_BASE_URL: r2PublicBaseUrl,
  // Upstash Redis backs rate limiting. Optional: when unset (e.g. local dev)
  // the limiters no-op and requests aren't throttled — see lib/security/
  // rate-limit.ts. Set both in uat/prod (each environment its own database)
  // so abuse guards are enforced. Validated only when present — partial
  // config (one without the other) is rejected below via hasRedisEnv usage.
  UPSTASH_REDIS_REST_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url("UPSTASH_REDIS_REST_URL must be a valid URL.").optional()
  ),
  UPSTASH_REDIS_REST_TOKEN: optionalString,
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required."),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required."),
  // Google Gemini — primary provider for dish-image generation (Gemini 2.5
  // Flash Image: flat ~$0.039/image). Optional: when unset, dish images fall
  // back to gpt-image-1. See lib/ai/providers/gemini.ts.
  GEMINI_API_KEY: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  CRON_SECRET: optionalString,
  // Stripe. The sellable catalog (tiers + credit packs) is NOT configured
  // via env — it's synced live from Stripe (`services/stripe-catalog.ts`),
  // keyed by Price metadata. Only the three core keys live here; the pricing
  // page shows "coming soon" when they're missing instead of crashing.
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_PUBLISHABLE_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
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
  // Browser-exposed env tag — the non-public `SENTRY_ENVIRONMENT` doesn't
  // reach the client bundle, so set this to tag UAT *client* errors. Omit
  // in prod (the NODE_ENV fallback already yields "production").
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: optionalString,
  // PostHog product analytics — public, client-side. Inert without the
  // key. See also `lib/env/public.ts` (where the client reads them).
  NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN: optionalString,
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

const databaseUrlSchema = z
  .string()
  .url("DATABASE_URL must be a valid Postgres connection URL.");

let cachedDatabaseUrl: string | null = null;

/**
 * Validate and return ONLY `DATABASE_URL`, independent of the full
 * `getServerEnv()` schema.
 *
 * `getServerEnv()` validates every server var at once, including the
 * `required` AI keys (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`). That makes a
 * pure DB read transitively depend on unrelated keys: a public share-OG card
 * (token -> dish name, no AI) would fail to render if the AI key happened to
 * be unset, and the route is untestable locally without it. This narrow
 * accessor lets an env-guard-free read path (`lib/share/og-share-read.ts`)
 * open a pool with just the one var it actually needs. Still fail-fast on a
 * missing/invalid `DATABASE_URL`. Keep all `process.env` access in this file.
 */
export function getDatabaseUrl(): string {
  if (cachedDatabaseUrl) {
    return cachedDatabaseUrl;
  }

  const result = databaseUrlSchema.safeParse(process.env.DATABASE_URL);
  if (!result.success) {
    const messages = result.error.issues.map((issue) => issue.message);
    throw new Error(`Invalid DATABASE_URL:\n${messages.join("\n")}`);
  }

  cachedDatabaseUrl = result.data;
  return cachedDatabaseUrl;
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
 * All-or-none guard for Upstash Redis (rate limiting). Returns true only
 * when both halves are present — partial config would build a broken client.
 * When false (e.g. local dev), the limiters in lib/security/rate-limit.ts
 * no-op rather than throttle.
 */
export function hasRedisEnv(env = getServerEnv()) {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
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
    env.STRIPE_SECRET_KEY && env.STRIPE_PUBLISHABLE_KEY && env.STRIPE_WEBHOOK_SECRET
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
