# PostHog analytics — setup

PostHog tracks **visits** (pageviews + unique visitors) and **new users**
(person profiles, created when a signed-in user is identified). It's
**inert until `NEXT_PUBLIC_POSTHOG_KEY` is set** — no local/dev friction.

This is additive to the existing in-house analytics (`analytics_events`
table + `/admin/analytics`), which logs server-side product events
(`signed_up`, `meal_logged`, email lifecycle, …). PostHog adds the
client-side traffic + funnels/retention dashboards the in-house system
doesn't have. Both can run together.

## What's tracked

- **Visits** — a `$pageview` fires on every App Router navigation
  ([components/providers/posthog-provider.tsx](../apps/web/components/providers/posthog-provider.tsx)).
  PostHog's dashboards derive unique visitors, new vs returning, top
  pages, referrers automatically.
- **New users** — on login, `posthog.identify(userId, { email })` ties
  the session to a PostHog person. New persons = new users in PostHog.
- **Signups** — a `signed_up` event fires server-side at true account
  creation (the Better Auth `user.create` hook in
  [lib/auth/index.ts](../apps/web/lib/auth/index.ts)), captured via
  `posthog-node`, *not* when the magic link is requested. The same event
  lands in the in-house `analytics_events` log at the same moment, so the
  two systems agree. Returning sign-ins fire `signed_in` from the client
  auth form.
- `person_profiles: "identified_only"` — anonymous visits are still
  counted for traffic, but person records are only created for signed-in
  users (cost control).

## Enabling it

1. Create a PostHog project → copy the **Project API key** (starts with
   `phc_`).
2. Set env vars (Vercel Production / Preview). The key is public:
   ```
   NEXT_PUBLIC_POSTHOG_KEY=phc_…
   NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com   # or https://eu.i.posthog.com
   ```
3. Verify: `pnpm check:deploy` → `PostHog: enabled — analytics on; …`.
   Redeploy, load a page, and confirm the event appears in PostHog's
   Activity / Live events.

## Notes

- **Reverse proxy**: events are sent to `/ingest/*`, which `next.config.ts`
  rewrites to the PostHog ingestion + asset hosts. This keeps ad-blockers
  (which blocklist `*.posthog.com`) from undercounting visits. The region
  is derived from `NEXT_PUBLIC_POSTHOG_HOST` (US default; set the EU host
  for EU projects and the asset host follows automatically).
- **CSP**: requests are same-origin (`/ingest`), so no `connect-src`
  changes are needed.
- Session replay is **off** for v1 (not initialized). Enable later via
  `posthog.init({ ..., session_recording })` + the replay add-on if you
  want it.
- The signup funnel works out of the box: `$pageview` → `signed_up`
  (server-side, account creation). For other custom client events use the
  `capturePostHogEvent(name, props)` helper exported from the PostHog
  provider — it no-ops when PostHog isn't configured.
