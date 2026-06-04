// Sentry — Node.js server runtime init (procedures, route handlers, the
// Stripe/Resend webhooks, the lifecycle cron). Loaded by `instrumentation.ts`
// when the runtime is "nodejs".
//
// Inert without a DSN: `Sentry.init` with an empty/undefined DSN disables
// the SDK entirely (no network, no overhead), so local/dev/preview need
// no Sentry env vars. Reads `process.env` directly rather than the typed
// `getServerEnv()` — this runs at the instrumentation boundary, before the
// app's server-only modules, and must not pull `server-only` into scope.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  // Performance tracing: sample lightly in prod, off in dev. Errors are
  // always captured regardless of this rate.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  // Don't send PII (emails, IP) by default — this app handles personal
  // recipe data; opt into specific context per-capture instead.
  sendDefaultPii: false,
  enabled: Boolean(dsn)
});
