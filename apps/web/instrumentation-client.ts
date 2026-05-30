// Sentry — browser/client init. Next 15+/16 loads `instrumentation-client.ts`
// automatically on the client. Only the public DSN is available here.
// Inert without it, so dev/preview ship no client Sentry bundle behaviour.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn,
  environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  // Session replay is opt-in and adds weight — leave it off for v1; can
  // be enabled later via replaysSessionSampleRate / an integration.
  sendDefaultPii: false,
  enabled: Boolean(dsn)
});

// Instruments App Router client navigations for tracing. No-op when the
// SDK is disabled.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
