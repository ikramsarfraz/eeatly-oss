# Sentry error tracking — setup

Sentry is wired for the web app (`@sentry/nextjs`) and **inert until a DSN
is set** — no local/dev/preview friction, no overhead, no network. Turning
it on is purely environment variables, like the Stripe toggle.

## What's covered

- **Server runtime** — tRPC procedures, route handlers, the Stripe/Resend
  webhooks, the lifecycle cron (`sentry.server.config.ts` via
  `instrumentation.ts`).
- **Edge runtime** — middleware (`sentry.edge.config.ts`).
- **Client** — browser errors + router-transition tracing
  (`instrumentation-client.ts`).
- **Server-component / route errors** — `onRequestError` hook in
  `instrumentation.ts`.
- **tRPC 500s** — the fetch adapter's `onError`
  ([app/api/trpc/[trpc]/route.ts](../apps/web/app/api/trpc/[trpc]/route.ts))
  calls `Sentry.captureException` only for `INTERNAL_SERVER_ERROR`, tagged
  by procedure path with the resolved pg/Drizzle cause chain attached.
  Deliberate 4xx contract errors (UPGRADE_REQUIRED, RATE_LIMITED, auth,
  validation) are intentionally **not** sent — they're normal.

## Enabling it

1. Create a project in Sentry → get the **DSN**.
2. Set env vars (Vercel Production, and Preview if you want):
   ```
   SENTRY_DSN=https://…@…ingest.sentry.io/…
   NEXT_PUBLIC_SENTRY_DSN=<same DSN>   # client needs the public one
   SENTRY_ENVIRONMENT=production        # optional; tags events
   ```
3. (Optional but recommended) source-map upload for readable stack traces.
   Create an org auth token in Sentry and set at **build time**:
   ```
   SENTRY_AUTH_TOKEN=sntrys_…
   SENTRY_ORG=<your-org>
   SENTRY_PROJECT=<your-project>
   ```
   Without `SENTRY_AUTH_TOKEN` the build skips upload (no failure) — errors
   still report, just with minified frames.
4. Verify: `pnpm check:deploy` → `Sentry: enabled — error tracking on; …`.
   Redeploy. Trigger a test error and confirm it lands in Sentry.

## Notes

- The DSN is safe to expose (that's by design); it only allows *sending*
  events, not reading them.
- Client events tunnel through `/monitoring` (configured in
  `next.config.ts`) so ad-blockers / strict CSP can't silently drop them.
- `tracesSampleRate` is 0.1 in production, 0 in dev. Errors are always
  captured regardless. Session replay is off for v1.
- `sendDefaultPii: false` — this app holds personal recipe data, so PII
  (email/IP) is not attached by default. Add per-capture context if needed.
