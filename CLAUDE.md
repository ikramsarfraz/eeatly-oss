# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Start dev server (localhost:3000)
pnpm build            # Production build
pnpm lint             # ESLint — zero warnings tolerated
pnpm typecheck        # tsc --noEmit

pnpm db:generate      # Generate Drizzle migration from schema changes
pnpm db:migrate       # Apply migrations to Neon Postgres
pnpm db:studio        # Drizzle Studio GUI

pnpm auth:generate    # Regenerate Better Auth schema (run after auth config changes)
pnpm check:deploy     # Validate all required env vars are present
pnpm smoke:prod       # HTTP smoke tests against production
```

Node 24.14.x and pnpm 10.33.x are required (enforced via `engines` in package.json).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4  
Better Auth v1.4 (magic links, Drizzle adapter) · Drizzle ORM + Neon serverless Postgres  
Resend + React Email · AWS S3 / Cloudflare R2 (photo uploads) · TanStack Query v5

## Architecture

### Request flow

```
UI Component → Server Action (actions/) → Service (services/) → Drizzle ORM → Neon Postgres
```

Server Actions handle auth checks, input validation (Zod), rate limiting, path revalidation, and fire analytics events. Services contain the business logic and are the only layer that touches the database directly. Components use TanStack Query for client-side data fetching against API routes; mutations go through Server Actions.

### App Router layout groups

| Group | Path | Purpose |
|---|---|---|
| `(auth)` | `/sign-in`, `/sign-up` | Unauthenticated shell |
| `(dashboard)` | `/dashboard`, `/settings` | Authenticated app shell |
| `(public)` | `/privacy`, `/help` | Public marketing-adjacent pages |
| `admin/` | `/admin/*` | Platform admin — separate from layout groups |

### Auth

Magic links only — no password auth. Session is cached for 5 minutes server-side via Better Auth's cookie cache. Admin access checks `user.role === 'platform_admin'` plus an optional `PLATFORM_ADMIN_HOST` subdomain match. When changing the Better Auth config, run `pnpm auth:generate` to keep the schema in sync.

### Database schema

Core tables live in `db/schema/`:
- `meals` — unique per `(userId, normalizedName)`; soft-deleted via `archivedAt` (always filter with `isNull(archivedAt)`)
- `mealLogs` — one log per cooking event; has `effortLevel` enum: `quick | easy | medium | high_effort`
- `analytics_events` — in-house event tracking
- `email_delivery` — Resend webhook delivery receipts
- `tenants` / `tenant_members` — multi-tenant scaffold present in schema but not active in product logic

Always run `pnpm db:generate` then `pnpm db:migrate` after schema changes. Never hand-edit files in `drizzle/` (auto-generated migration history).

### Environment variables

Four vars are required at runtime; the rest enable optional features:

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon pooled connection string |
| `BETTER_AUTH_SECRET` | ✅ | ≥32 chars, signs sessions |
| `BETTER_AUTH_URL` | ✅ | App origin (e.g. `https://eeatly.app`) |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public origin (the only `NEXT_PUBLIC_` var) |
| `RESEND_API_KEY` + `EMAIL_FROM` | optional | Magic link email; falls back to console.log |
| `RESEND_WEBHOOK_SECRET` | optional | Email delivery tracking |
| R2 group (5 vars) | optional | Photo uploads — **all five must be set or none** |
| `PLATFORM_ADMIN_HOST` | optional | Restricts `/admin/*` to a specific subdomain |

All server-side env access goes through `lib/env/server.ts` → `getServerEnv()`, which validates and caches at startup. Never read `process.env` directly in server code.

### Key patterns

- **`server-only`** — imported at the top of any module that must never reach the client bundle (`services/`, `lib/db/`, `lib/auth/`). A build error surfaces immediately if the boundary is crossed.
- **Meal normalization** — `normalizedName` is `name.trim().toLowerCase()`. The unique index enforces one `meals` row per user per dish name; logging the same meal again creates a new `mealLogs` row against the existing `meals` row.
- **Observability** — `lib/observability/` holds the analytics event logger and funnel-tracking helpers. Events are fire-and-forget (not awaited) inside Server Actions.
- **Email fallback** — when `RESEND_API_KEY` is absent, `lib/email/resend.ts` logs the email to the console instead of throwing. This keeps local dev functional without Resend credentials.
- **Security headers** — defined in `next.config.ts` (CSP, X-Frame-Options DENY, Permissions-Policy). Do not add `<iframe>` embeds without updating the CSP.
