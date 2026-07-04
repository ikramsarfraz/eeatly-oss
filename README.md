# eeatly

eeatly is a personal recipe library and meal-planning app: capture recipes (text, voice, or photo), refine them with AI, log cooking history, plan meals, and share selectively within a household. A Next.js web app and an Expo mobile client share one typed tRPC API.

> Source-available under **AGPL-3.0**. This is the codebase behind a running product; see [License](#license) before deploying your own copy.

## Monorepo layout

pnpm workspaces:

```
apps/
  web/        Next.js 16 (App Router) — the eeatly web product
  mobile/     Expo + React Native — full client (auth, library, recipe
              detail, Refine, meal plans, household, AI capture, settings)
packages/
  api/        AppRouter type + validators + feature-gate registry
              (both clients import via subpath exports)
  shared/     Framework-agnostic pure utilities
```

Every command below runs from the **repo root** unless noted.

## Stack

- Next.js 16 App Router, React 19, TypeScript 5
- Tailwind CSS 4 and shadcn/ui-style components (web); Expo + NativeWind (mobile)
- tRPC v11 + superjson — every client-driven interaction
- Better Auth with Drizzle adapter (magic links, optional Google OAuth)
- Neon serverless Postgres, Drizzle ORM, Drizzle Kit (with optional Postgres RLS)
- OpenAI (primary) + Anthropic (fallback) for capture / refine / share copy; Whisper transcription
- TanStack Query v5, TanStack Table v8
- React Hook Form and Zod
- Resend, React Email, Cloudflare R2
- Stripe (billing)

## Local Setup

```bash
nvm use
corepack enable
corepack prepare pnpm@10.33.2 --activate
pnpm install
cp apps/web/.env.example apps/web/.env.local
pnpm dev
```

Open `http://localhost:3000`. The project is pinned to Node `24.14.x` and pnpm `10.33.x`.

Start the mobile bundler (with the web dev server running): `pnpm --filter @eeatly/mobile start`

## Auth And Database

eeatly uses Better Auth magic links backed by Neon Postgres through Drizzle. Set
`DATABASE_URL`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and `BETTER_AUTH_SECRET` in
`.env.local`, then generate and apply migrations:

```bash
pnpm db:generate
pnpm db:migrate
```

For local email-only sign-in, set `RESEND_API_KEY` and `EMAIL_FROM`. If those are missing,
eeatly prints the magic sign-in link to the dev server console so local development can
continue without sending real email.

## Required Environment Variables

Server-only:

- `DATABASE_URL` — Neon serverless Postgres URL (use the pooled connection string)
- `BETTER_AUTH_SECRET` — 32-byte or longer secret for Better Auth
- `BETTER_AUTH_URL` — App origin used by Better Auth, e.g. `https://eeatly.app`
- `OPENAI_API_KEY` — primary AI provider (capture, refine) and Whisper transcription
- `ANTHROPIC_API_KEY` — AI fallback provider (capture, refine, share copy)
- `RESEND_API_KEY` and `EMAIL_FROM` — required before sending production magic-link email
- `RESEND_WEBHOOK_SECRET` (typically `whsec_…`) — Svix signing secret from the Resend webhook pointed at `/api/webhooks/resend`; optional locally
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` — all required together for photo uploads; omit all to disable
- `PLATFORM_ADMIN_HOST` — optional hostname required to access `/admin/*` when set

Public:

- `NEXT_PUBLIC_APP_URL` — Public app URL, must match production origin in Vercel

Only `NEXT_PUBLIC_APP_URL` is intentionally exposed to the browser. Keep all other variables server-only.

## Local Testing

1. `pnpm dev` → open `http://localhost:3000/sign-in`
2. Enter an email → copy the magic link from the dev server console
3. Log a meal from the dashboard Quick log form
4. Confirm the meal appears in Recent meals, History, and stats after additional logs
5. Submit feedback from the app shell or Settings
6. As a `platform_admin`, review feedback at `/admin/feedback` and delivery health at `/admin/emails`

Verification commands:

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm check:deploy
pnpm smoke:prod -- --base-url http://localhost:3000
```

## Troubleshooting

- **Corepack not found** — run `nvm use` first. If `corepack` is still missing, use a Node 24 install that includes Corepack, then run `corepack enable`.
- **pnpm not found** — run `corepack prepare pnpm@10.33.2 --activate`. If Corepack is unavailable, install pnpm 10.33.x directly.
- **Node version mismatch** — run `nvm use` from the project root and confirm `node --version` reports `v24.14.x`.
- **Environment variables missing** — copy `apps/web/.env.example` to `apps/web/.env.local`, fill in the required vars, then run `pnpm db:generate` and `pnpm db:migrate`.

## Deployment

eeatly uses `vercel.json`: **installCommand** is `pnpm install --frozen-lockfile`, **buildCommand** is `pnpm build`. Migrations are **not** run during the build and must be applied separately.

### Production deployment order

1. **Neon** — create a Postgres database; copy the pooled connection string for `DATABASE_URL`
2. **Vercel project** — import the repo; confirm install and build commands match `vercel.json`
3. **Environment variables** — set all required variables for the Production environment in Vercel → Settings → Environment Variables
4. **Migrations** — run `pnpm db:migrate` from a trusted machine with the production `DATABASE_URL` before traffic relies on new schema
5. **Deploy** — ship the production deployment
6. **Resend** — configure a verified sender, `RESEND_API_KEY`, `EMAIL_FROM`, and optionally webhooks (see below)
7. **Smoke test** — run `pnpm check:deploy` and `pnpm smoke:prod -- --base-url https://<your-domain>`
8. **Admin** — promote a user to `platform_admin` (see Platform Admin below)

Full pre-launch checklist: [docs/public-beta-launch-checklist.md](docs/public-beta-launch-checklist.md)

### Deployment readiness commands

```bash
pnpm check:deploy                                         # validates required env vars
pnpm smoke:prod -- --base-url https://your-domain        # HTTP smoke tests
pnpm db:migrate                                           # apply schema changes
```

### Neon

1. Create a Neon Postgres project
2. Use the pooled/serverless `DATABASE_URL` in Vercel and when running `pnpm db:migrate`

### Better Auth

Set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the production origin. Use a strong
unique `BETTER_AUTH_SECRET`. Better Auth owns session cookies; sessions are validated
server-side only.

### Resend

Create a Resend API key and verified sender. Set `RESEND_API_KEY` and `EMAIL_FROM`.

**Webhooks**

1. Add a webhook in the Resend dashboard pointing to `https://<your-domain>/api/webhooks/resend`
2. Enable events: `email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`, `email.failed`, `email.delivery_delayed`, `email.suppressed`
3. Copy the signing secret (`whsec_…`) to `RESEND_WEBHOOK_SECRET` in Vercel
4. Confirm delivery rows appear in `/admin/emails` after sending a magic link

### Cloudflare R2

Create a bucket, R2 API credentials, and a public asset base URL. Set all five `R2_*`
variables together. Without them, text meal logging works but photo uploads return a
configuration error.

### Platform Admin

After a user signs in, promote them via SQL:

```sql
UPDATE "user"
SET role = 'platform_admin'
WHERE email = 'admin@example.com';
```

If `PLATFORM_ADMIN_HOST` is set, `/admin/*` requires both the `platform_admin` role and
that request host.

## Beta Testing Checklist

- Sign up or sign in with an email magic link
- Confirm `/dashboard` redirects to `/sign-in` when logged out
- Log a first meal from the dashboard Quick log form
- Log the same meal again and confirm the cook count updates
- View the History page and confirm recent logs appear
- Submit feedback with type, message, and optional context
- Confirm a platform admin can review feedback at `/admin/feedback`
- Confirm a platform admin can review cohort and retention data at `/admin/users`
- After configuring Resend webhooks, confirm `/admin/emails` shows outbound rows

## Beta Operations

- **Activation and retention** — `/admin/analytics` shows funnel events and cohort slices
- **User management** — `/admin/users` shows retention segments (New, Activated, At risk, Inactive) with manual email actions
- **Feedback review** — `/admin/feedback` for qualitative signals; prioritise confusion reports over feature requests while the funnel is settling
- **Email health** — `/admin/emails` for delivery status after webhooks are configured

Detailed runbooks: [docs/beta-launch-runbook.md](docs/beta-launch-runbook.md) · [docs/production-smoke-test.md](docs/production-smoke-test.md)

## Analytics

eeatly stores privacy-first product analytics in the `analytics_events` table. Events
are recorded server-side and used for beta product health only — not ads or third-party
tracking. Platform admins can view aggregates at `/admin/analytics`.

Key tracked events: `signed_up`, `signed_in`, `completed_onboarding`, `first_meal_logged`,
`second_meal_logged`, `meal_logged`, `meal_logged_again`, `feedback_submitted`,
`rediscovery_clicked`, and email lifecycle events from Resend webhooks.

## What eeatly Does (and Does Not) Do

**Implemented:**
- Recipe capture from text, voice, or photo, plus AI "Refine" editing
- Structured recipes (ingredients + steps) with a legacy free-text fallback
- Quick meal logging with optional notes and photo; personal cooking history
- Most cooked meals, meals not cooked recently, and smart rediscovery
- Meal planning (named, ordered collections of dishes)
- Household sharing with per-item view/edit/admin grants and link shares
- Full Expo mobile client (auth, library, recipe detail, Refine, plans, capture)
- Billing (Stripe): free / plus / pro tiers with feature gates
- Settings and account management
- Platform admin dashboard (analytics, users, feedback, email delivery)

**Out of scope for now:**
- Nutrition tracking
- Grocery lists
- General social feed

## Architecture

Design notes, request flow, database schema, the auth model, and the Row-Level Security rollout are documented in [CLAUDE.md](CLAUDE.md). Additional runbooks and audits live under [docs/](docs/).

## Contributing

Issues and pull requests welcome. Before submitting, make sure `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass. Contributions are accepted under the project's AGPL-3.0 license.

## License

Copyright (C) 2026 Ikram Sarfraz.

This program is free software: you can redistribute it and/or modify it under the terms of the **GNU Affero General Public License** as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

AGPL-3.0 is a strong copyleft license: **if you run a modified version of this software as a network service, you must make your modified source available to its users.** Full text in [LICENSE](LICENSE).
