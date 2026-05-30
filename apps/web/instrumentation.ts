// Next.js instrumentation hook. Runs once per server runtime at startup.
// Loads the matching Sentry init (Node vs Edge) and exposes the request-
// error hook so server-component / route-handler errors are captured.
//
// All inert without a Sentry DSN — the config files disable the SDK when
// the DSN is absent.
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Captures errors thrown in nested React Server Components / route
// handlers that Next surfaces via this hook.
export const onRequestError = Sentry.captureRequestError;
