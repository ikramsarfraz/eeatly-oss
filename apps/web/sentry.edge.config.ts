// Sentry — Edge runtime init (middleware + any edge route handlers).
// Loaded by `instrumentation.ts` when the runtime is "edge". Inert without
// a DSN, same as the server config.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  sendDefaultPii: false,
  enabled: Boolean(dsn)
});
