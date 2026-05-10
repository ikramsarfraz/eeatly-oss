# CookLoop

CookLoop is a personal cooking memory app for quick meal logging, cooking history, and smart meal resurfacing.

## Stack

- Next.js 16 App Router, React 19, TypeScript 5
- Tailwind CSS 4 and shadcn/ui-style components
- Better Auth with Drizzle adapter
- Neon serverless Postgres, Drizzle ORM, Drizzle Kit
- TanStack Query v5, TanStack Table v8
- React Hook Form and Zod
- Resend, React Email, Cloudflare R2 placeholders

## Local Setup

```bash
nvm use
corepack enable
corepack prepare pnpm@10.33.2 --activate
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`.

The project is pinned to Node `24.14.x` and pnpm `10.33.x`.

```bash
node --version
pnpm --version
```

## Auth And Database

CookLoop uses Better Auth magic links backed by Neon Postgres through Drizzle. Set
`DATABASE_URL`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and `BETTER_AUTH_SECRET` in
`.env.local`, then generate and apply migrations:

```bash
pnpm db:generate
pnpm db:migrate
```

Better Auth core tables are included in `db/schema/auth.ts`. The auth configuration also supports Better Auth schema generation through:

```bash
pnpm auth:generate
```

For local email-only sign-in, configure `RESEND_API_KEY` and `EMAIL_FROM`. If those are
missing, CookLoop prints the magic sign-in link to the dev server console so local
development can continue without sending real email.

## Required Environment Variables

Server-only:

- `DATABASE_URL`: Neon serverless Postgres URL.
- `BETTER_AUTH_SECRET`: 32-byte or longer secret for Better Auth.
- `BETTER_AUTH_URL`: App origin used by Better Auth, for example `https://cookloop.example`.
- `RESEND_API_KEY` and `EMAIL_FROM`: required before sending production magic-link email.
- `RESEND_WEBHOOK_SECRET` (typically `whsec_…`): Svix signing secret from the Resend webhook you point at `/api/webhooks/resend`. Optional locally; omit or leave unset to disable ingestion (endpoint returns HTTP 503 without it).
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`: required before photo uploads work.
- `PLATFORM_ADMIN_HOST`: optional hostname required for `/admin/*` when set.

Public:

- `NEXT_PUBLIC_APP_URL`: Public app URL used by client helpers.

The dashboard is protected. Without a valid Better Auth session, users are redirected to
`/sign-in`. Meal data is always scoped to the authenticated user id.

## Local Testing

1. Start the app with `pnpm dev`.
2. Open `http://localhost:3000/sign-in`.
3. Enter an email address and open the magic link from email or the dev server console.
4. Log a meal from the dashboard Quick log form.
5. Confirm the meal appears under Recent meals, History, and stats after additional logs.
6. Submit beta feedback from the app shell or Settings.
7. As a `platform_admin`, review feedback at `/admin/feedback` and delivery health at `/admin/emails` (after configuring Resend webhooks).

Useful verification commands:

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm check:deploy
pnpm smoke:prod -- --base-url http://localhost:3000
```

## Troubleshooting

- Corepack not found: run `nvm use` first. If `corepack` is still missing, use a Node
  24 install that includes Corepack, then run `corepack enable`.
- pnpm not found: run `corepack prepare pnpm@10.33.2 --activate`. If Corepack is not
  available, install pnpm 10.33.x for your shell and confirm with `pnpm --version`.
- Node version mismatch: run `nvm use` from the project root and confirm `node --version`
  reports `v24.14.x`.
- Environment variables missing: copy `.env.example` to `.env.local`, set
  `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `NEXT_PUBLIC_APP_URL`,
  then run `pnpm db:generate` and `pnpm db:migrate`.

## Deployment

CookLoop uses `vercel.json`: **`installCommand`** is `pnpm install --frozen-lockfile`, **`buildCommand`** is `pnpm build`. Migrations are **not** run during install/build unless you add a custom pipeline step.

### Production deployment order

Follow this order for a clean first production deploy and for major releases:

1. **Neon** — Create a Postgres database; copy the **pooled / serverless** connection string for `DATABASE_URL`.
2. **Vercel project** — Import the Git repository; confirm install and build commands match `vercel.json` (pnpm + `pnpm build`).
3. **Environment variables** — In Vercel → Settings → Environment Variables, set Production values for every variable in **Required Environment Variables** (including `NEXT_PUBLIC_APP_URL` and `BETTER_AUTH_URL` matching your live origin).
4. **Apply migrations** — From a trusted machine or CI job with the **production** `DATABASE_URL`, run `pnpm db:migrate` after the deployment artifact includes the migration files. Schema changes must be applied **before** traffic relies on them.
5. **Deploy** — Ship the production deployment (or promote after Preview validation).
6. **Resend** — Verified sender, `RESEND_API_KEY` / `EMAIL_FROM`, optional webhooks to `https://<your-domain>/api/webhooks/resend` and `RESEND_WEBHOOK_SECRET` (see **Resend** below).
7. **Smoke test** — Run `pnpm check:deploy` (with env loaded) and `pnpm smoke:prod -- --base-url https://<your-domain>` against the live site.
8. **Admin** — Promote a user to `platform_admin` (SQL under **Platform Admin**). Optionally set `PLATFORM_ADMIN_HOST` and open `/admin/*` only on that host.

**Long-form checklists:** [docs/production-smoke-test.md](docs/production-smoke-test.md) · [docs/beta-launch-runbook.md](docs/beta-launch-runbook.md)

### Deployment readiness commands

```bash
pnpm check:deploy
pnpm smoke:prod -- --base-url https://your-production-origin
pnpm db:migrate
```

- **`pnpm check:deploy`** — Verifies required env vars are present (loads `.env.local` and `.env` when they exist). Does not print secret values.
- **`pnpm smoke:prod`** — HTTP checks only (no login): public pages 200, protected routes redirect, admin not returned as 200 anonymously, webhook rejects unsigned `POST`.
- **`pnpm db:migrate`** — Run with production `DATABASE_URL` when shipping schema; **not** invoked by `pnpm build` by default.

### Vercel build safety

- **Install** / **build** — Frozen lockfile + `pnpm build` as above.
- **Migrations** — Run explicitly (`pnpm db:migrate`); they do **not** run automatically on Vercel build.
- **Client bundle** — Server-only secrets stay in server modules (`lib/env/server`, etc.); only `NEXT_PUBLIC_APP_URL` is public. Set it in production so layouts and URLs do not rely on a localhost fallback.
- **Hardcoded URLs** — No `localhost` URLs are required in application source; production relies on environment configuration.

### Neon

1. Create a Neon Postgres project.
2. Use the pooled/serverless `DATABASE_URL` in Vercel and in the shell where you run `pnpm db:migrate`.

### Better Auth

Set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the production origin. Use a
strong unique `BETTER_AUTH_SECRET` in production. Better Auth owns session cookies
and CookLoop validates sessions only on the server.

### Resend

Create a Resend API key and verified sender. Set `RESEND_API_KEY` and `EMAIL_FROM`
so beta users receive magic links.

**Webhooks (production / beta observability)**

1. Expose `POST /api/webhooks/resend` on a public HTTPS URL, for example `https://app.example.com/api/webhooks/resend` (App Router route).
2. In the [Resend dashboard](https://resend.com/webhooks), create a webhook for that URL and enable at least these **email** events: `email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`, `email.failed`, `email.delivery_delayed`, `email.suppressed`.
3. Copy the webhook **signing secret** (`whsec_…`) into server env as `RESEND_WEBHOOK_SECRET`. The handler verifies Svix signatures with the raw POST body (`svix-id`, `svix-timestamp`, `svix-signature` headers); misconfiguration returns `401`.
4. Run `pnpm db:migrate` after pulling so `email_delivery_logs`, `resend_webhook_receipts`, and new `analytics_event_name` enum values exist.
5. **Local testing**: use [`ngrok`](https://ngrok.com/) port forwarding or [Resend webhooks CLI](https://resend.com/docs/dashboard/webhooks/introduction). Point the webhook URL at your tunnel, set `RESEND_WEBHOOK_SECRET` in `.env.local`, restart `pnpm dev`, send a mail from the app or admin “Welcome” action, and confirm rows in `/admin/emails` plus `email_*` counts in `/admin/analytics`.
6. **Production verification checklist**
   - `RESEND_WEBHOOK_SECRET` set in Vercel (or host) for Production and Preview as needed.
   - Webhook shows recent successful deliveries (HTTP 200) in the Resend dashboard.
   - Suppression / bounce events appear in `/admin/emails` with failure text and in analytics as `email_bounced`, `email_complained`, or `email_delivery_failed`.
   - Duplicate retries (same `svix-id`) do not duplicate database updates; failed processing after claim returns `500` so Resend can retry safely.

**How events show in the app**

- `/admin/emails`: merged row per Resend `email_id` (template tag, recipient, status, last provider event, failure reason).
- `/admin/analytics`: aggregate `email_sent` (from successful API sends with an id), `email_delivered`, `email_opened`, `email_clicked`, `email_bounced`, `email_complained`, `email_delivery_failed` (plus existing `reminder_email_sent` for lifecycle campaigns). Webhook `email.sent` updates the delivery log only (avoids double-counting `email_sent` with the API path).

Transactional sends attach Resend **tags** `cookloop_template` and `cookloop_user_id` (when the user id matches Resend’s tag character rules) so webhook payloads can join back to templates and users.

### Cloudflare R2

Create a bucket, R2 API credentials, and a public asset base URL. Set all `R2_*`
variables. Without R2, text meal logging still works but photo upload requests
return a configuration error.

### Platform Admin

Promote a user after they sign in:

```sql
update "user"
set role = 'platform_admin'
where email = 'admin@example.com';
```

If `PLATFORM_ADMIN_HOST` is set, `/admin/*` requires both the `platform_admin`
role and that request host. For example, set it to `admin.cookloop.example`.

Only `NEXT_PUBLIC_APP_URL` is intentionally exposed to the browser. Keep all other
environment variables server-only.

## Beta Testing Checklist

- Sign up or sign in with an email magic link.
- Confirm `/dashboard` redirects to `/sign-in` when logged out.
- Log a first meal from the dashboard Quick log form.
- Log the same meal again and confirm the cook count updates.
- View the History page and confirm recent logs appear.
- Submit feedback with type, message, and optional page/context.
- Confirm a platform admin can review feedback at `/admin/feedback`.
- Confirm a platform admin can review cohort + retention ops at `/admin/users`.
- Confirm R2 photo upload works if photo uploads are part of the beta.
- After configuring Resend webhooks (`RESEND_WEBHOOK_SECRET`), confirm `/admin/emails` shows outbound rows and `/admin/analytics` includes `email_*` events.

## Weekly Beta Review Process

Use this lightweight cadence while the cohort is tiny; it biases decisions toward activation and retention signals instead of speculative features.

### Metrics worth a quick scan

Refer to `/admin/analytics`, which merges internal events with meal-derived cohort queries:

- Activation funnel completeness: onboarding confirmations, share of accounts with meal logs, second-meal progression, Useful idea confirmations (rediscovery).
- Retention helper slices: day-1 and day-7+ meal-return cohort percentages, cooks with ≥3 logged meals, repeated log-again usage.
- Operational friction proxies: median hours between consecutive logs per user, dormant accounts (`usersWithNoMeals`), weekly cooks who paused today (`activeLastWeekNotTodayViaMeals` via meal timestamps).
- Behavioral mix: dominant effort tiers and surfaced rediscovery reason labels (favorite vs neglected vs etc.) based on tapped metadata rather than guesses.

Combine those numbers with the qualitative backlog in `/admin/feedback` — prioritize bugs/confusion impacting the nightly cooking loop ahead of speculative feature requests unless they unblock funnel steps.

### What strong signals look like (early PMF)

- Rising second-meal conversion and repeat log-again activity without heavy prompt engineering.
- Day-7 cohorts holding steady or improving as onboarding copy tightens.
- Rediscovery engagement tracking real meals (distinct users confirming ideas) tied to recognizable reason labels rather than accidental taps.
- Qualitative mentions of clarity (“I knew what to log next”), not just praise for aesthetics.

### What not to obsess over yet

- Vanity traffic from marketing experiments before the funnel is stable.
- One-off integrations, heavy dashboards, pricing models, nutrition, groceries, AI, recipe sharing — all deliberately out-of-scope until the nightly loop reliably pulls people back.

Ship notes from each review inline in your issue tracker so later launches still map to empirical slices instead of anecdotes.

## Beta Operations Workflow

This phase is intentionally small: cohort visibility, repeatable retention labels, manual lifecycle email hooks, and SQL-friendly analytics—not new product surface area.

1. **Tag the cohort** — In `/admin/users`, assign each signup to `alpha`, `beta_wave_1`, `beta_wave_2`, or `internal` so later analytics can segment without ad-hoc spreadsheets.
2. **Scan retention slices** — Use segment chips (New, Activated, Engaged, At risk, Inactive) plus email search on the same page. Statuses are recomputed server-side from signup recency, meal counts, last meal date, and repeat logging (see `lib/retention/status.ts`).
3. **Respond with the right lever** — Use manual transactional sends (Welcome, First-meal poke, Quiet streak reminder, Weekly recap placeholder) only when `/admin/analytics` and the roster agree the user is stalled; skips are logged when Resend/env is unavailable.
4. **Webhook truth** — Resend Svix-signed `POST /api/webhooks/resend` updates `email_delivery_logs` plus `email_delivered/opened/clicked/...` analytics; duplicate `svix-id` retries are skipped. Operational views live at `/admin/emails`; aggregates stay in `/admin/analytics`.
5. **Placeholder stubs** — `/admin/users` can still emit `reminder_email_open_placeholder` / `reminder_email_clicked_placeholder` until ESP pixel/redirect wiring exists.
6. **Close the loop** — Pair numbers from `/admin/analytics` (including retention bucket counts and funnel events) with `/admin/feedback`; ship one retention or clarity fix before chasing net-new features unless a request unblocks onboarding or second meals.

Operational helpers live in `services/user-lifecycle.ts` (query builders for dormancy, exactly-one-meal cohorts, power users, and recent activation) and are meant to feed future cron or batch jobs—not to replace judgment this week.

## User Retention Review Process

Weekly (or twice weekly while cohort size is tiny):

1. Open `/admin/analytics` — note funnel completion, retention helper slices, and computed retention buckets.
2. Open `/admin/users`, filter **At risk** and **Inactive** — sort mentally by signup date vs last meal and read feedback counts for qualitative hints.
3. For each stalled account, decide **product fix vs personal outreach** vs **one targeted email**. Prefer fixes when multiple users hit the same wall.
4. Log decisions in your tracker (even one line): who was contacted, which template, and whether the problem was confusion vs habit vs life noise.

## When To Send Reminder Emails

- **Welcome** — After signup when you want a human welcome in addition to the magic link (ops-only; do not spam).
- **First-meal poke** — User finished onboarding (or is close) but has **zero meals** after a couple of days; pair with a quick check for UX blocks.
- **Quiet streak** — User has cooked before but **no meal in ~7+ days** and is not already **inactive** (long absence); keep copy light and single CTA.
- **Weekly recap placeholder** — Dry-run for a future digest; use only for internal or consenting testers until copy and scheduling exist.

If `RESEND_API_KEY` or `EMAIL_FROM` is missing, sends are skipped safely and logged—never throw in the request path.

## How To Identify At-Risk Users

Use the **At risk** segment on `/admin/users`. Under the hood, **at_risk** means early success (they logged at least one meal) but recent activity has cooled while they are not yet **inactive** (see `computeRetentionStatus`). Cross-check:

- **Exactly one meal** — `queryUsersWithExactlyOneMeal` in `services/user-lifecycle.ts` (classic second-meal cliff).
- **Quiet but not gone** — `queryUsersInactiveWithMealsForDays({ days: 7 })` for people who need a nudge before they fall into **inactive**.

## Prioritizing Feature Requests vs Retention Fixes

- **Bias to retention** when: second-meal rate is flat or down, **at_risk** count grows faster than signups, or feedback themes repeat (“didn’t know what to log”, “forgot the app exists”).
- **Ship a feature slice** when: it removes a specific funnel drop (e.g. clearer first log path) or is already promised to a paying design partner—still scope it as the smallest change that moves the metric you named.
- **Defer** large net-new modules (billing, nutrition, groceries, social, public recipes, AI) until weekly active logs per beta user trend up for two consecutive review cycles.

## Internal Analytics

CookLoop stores privacy-first product analytics in Postgres in the `analytics_events`
table. Events are recorded server-side and are used for beta product health, not ads
or third-party tracking.

Tracked funnel-oriented events include:

- `signed_up`
- `signed_in`
- `completed_onboarding` (plus legacy `onboarding_completed`)
- `first_meal_logged`
- `second_meal_logged`
- `reminder_email_sent`
- `reminder_email_open_placeholder`
- `reminder_email_clicked_placeholder`
- `email_sent`
- `email_delivered`
- `email_opened`
- `email_clicked`
- `email_bounced`
- `email_complained`
- `email_delivery_failed`
- `meal_logged`
- `meal_logged_again`
- `feedback_submitted`
- `rediscovery_clicked` (captures qualitative `reason` / `suggestionKind` strings)

Structured helpers live in `lib/observability/funnel.ts` so instrumentation stays cohesive.

Events may include a `userId` when the user is authenticated and small metadata such
as source or reason. Do not store message bodies, emails, or sensitive user content
in analytics metadata.

Platform admins can view simple aggregate analytics at `/admin/analytics`.

To disable analytics temporarily, replace `trackEvent()` in
`lib/observability/analytics.ts` with a no-op. Event writes are already non-blocking,
so analytics failures should not interrupt user actions.

## MVP Scope

Implemented foundation:

- Quick meal logging form with photo upload placeholder
- Recent cooking history
- Most cooked meals
- Meals not cooked recently
- Smart rediscovery suggestions
- Account/settings shell
- Tenant and platform-admin-ready auth schema foundation

Intentionally not included yet:

- Nutrition tracking
- Grocery lists
- Recipe importing
- Social features
- Tenant billing
- AI suggestions
