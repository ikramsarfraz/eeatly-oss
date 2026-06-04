// Sentry — browser/client init. Next 15+/16 loads `instrumentation-client.ts`
// automatically on the client. Only the public DSN is available here.
// Inert without it, so dev/preview ship no client Sentry bundle behaviour.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

// `SENTRY_ENVIRONMENT` isn't `NEXT_PUBLIC_`-prefixed, so Next.js doesn't inline
// it into the client bundle — in the browser it's always undefined and we'd
// fall back to NODE_ENV ("production" for any prod build, including UAT). To
// tag UAT *browser* errors correctly, prefer the public-exposed var here and
// set `NEXT_PUBLIC_SENTRY_ENVIRONMENT` per deploy (omit it in prod, where the
// NODE_ENV fallback already yields "production").
Sentry.init({
  dsn,
  environment:
    process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
    process.env.SENTRY_ENVIRONMENT ||
    process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  // Session replay is opt-in and adds weight — leave it off for v1; can
  // be enabled later via replaysSessionSampleRate / an integration.
  sendDefaultPii: false,
  enabled: Boolean(dsn)
});

// Instruments App Router client navigations for tracing. No-op when the
// SDK is disabled.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
