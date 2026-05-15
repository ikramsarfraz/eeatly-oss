# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Round 12 restructured this into a pnpm-workspaces monorepo:

```
apps/
  web/        Next.js app — the eeatly web product
  mobile/     Expo + React Native — Phase-1 magic-link auth (R12);
              features land in R13+
packages/
  api/        AppRouter type + validators + gate registry — both clients
              import via subpath exports (`@eeatly/api/validators/meals`,
              `@eeatly/api/gates/registry`, etc.)
  shared/     Pure utilities, framework-agnostic. Currently
              `normalizeMealName`; grows as cross-app reuse surfaces.
```

Every command below runs from the **repo root**; pnpm filters into `@eeatly/web` by default. Mobile-specific flows live under `apps/mobile/`; see [docs/mobile-dev-runbook.md](docs/mobile-dev-runbook.md) for the dev-client install + verify steps.

## Commands

```bash
pnpm dev              # Start web dev server (localhost:3000)
pnpm build            # Production build of the web app
pnpm lint             # ESLint — zero warnings tolerated
pnpm typecheck        # tsc --noEmit (every workspace package in parallel)

pnpm db:generate      # Generate Drizzle migration from schema changes
pnpm db:migrate       # Apply migrations to Neon Postgres
pnpm db:studio        # Drizzle Studio GUI

pnpm auth:generate    # Regenerate Better Auth schema (run after auth config changes)
pnpm check:deploy     # Validate all required env vars are present
pnpm smoke:prod       # HTTP smoke tests against production
```

To work directly inside a workspace, `cd apps/web && pnpm <script>` works too — but prefer the root commands so the right workspace is always selected.

Node 24.14.x and pnpm 10.33.x are required (enforced via `engines` at the root `package.json`).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4  
Better Auth v1.4 (magic links, Drizzle adapter) · Drizzle ORM + Neon serverless Postgres  
Resend + React Email · AWS S3 / Cloudflare R2 (photo uploads) · TanStack Query v5  
tRPC v11 + superjson (Round 11 — every client-driven interaction)

## Architecture

### Request flow

```
Client component → trpc.<router>.<proc>.useQuery|useMutation → tRPC procedure → Service (services/) → Drizzle ORM → Neon Postgres
Server component → Service (direct import) → Drizzle ORM → Neon Postgres
```

Round 11 removed the `actions/` layer entirely. Every client-driven interaction now goes through a tRPC procedure; server components that need to read data still call services directly (no point routing SSR fetches through HTTP).

- **Procedures** live in `apps/web/server/trpc/routers/<domain>.ts` and are merged into `apps/web/server/trpc/app-router.ts`. The `AppRouter` type is what the client imports for typed hooks.
- **Middleware + procedure builders** in `apps/web/server/trpc/trpc.ts`: `publicProcedure`, `protectedProcedure`, `adminProcedure`, `householdMemberProcedure`, `householdOwnerProcedure`, `gatedProcedure(featureKey)`, `rateLimit(kind)`. Compose with `.use(...)`.
- **Context** (`apps/web/server/trpc/context.ts`) lifts the Better Auth session once per request and memoizes the current-household lookup via React.cache.
- **Errors** use `TRPCError` with structured `cause`: `{ reason, … }`. The wire-stable `reason` strings (`UPGRADE_REQUIRED`, `RATE_LIMITED`, `OWNER_BLOCK`, `MEAL_NAME_COLLISION`, etc.) are what the client UI matches on via `apps/web/lib/trpc/errors.ts` (`getCause`, `isUpgradeRequired`, `isRateLimited`).
- **Fetch adapter** at `apps/web/app/api/trpc/[trpc]/route.ts` handles both GET (queries) and POST (mutations). Force-dynamic so cookies + rate limits aren't cached.
- **Client integration** is co-located in `apps/web/components/providers/query-provider.tsx`: a single `QueryClient` is shared between `<trpc.Provider>` and `<QueryClientProvider>`.

**File uploads stay on REST.** Persisted photos go through the existing R2 presigned-POST flow (`apps/web/app/api/uploads/presign`). Multipart bodies don't ride through tRPC. The one exception: AI-suggest photo + voice inputs ride as base64 strings in the JSON body (see [apps/web/server/trpc/routers/ai.ts](apps/web/server/trpc/routers/ai.ts) for the trade-off rationale — preserves behavior and avoids orphan R2 uploads for one-shot AI calls).

**Video sources ride through URL references, not AI extraction.** Round 16 removed the YouTube transcript path (scraping violated YouTube ToS, the upstream library was abandoned, and audio-on-Whisper fallbacks carry their own legal risk at scale). Users now paste a URL into the meal log form's "Source URL" field and the recipe view embeds the result:
- **YouTube** / **TikTok** / **Pinterest** → native iframe / WebView embed.
- **Instagram** / arbitrary web URLs → server-side OG preview card (real Instagram embeds need a Meta Developer + App Review approval — deferred).
- Server-side OG fetching is gated by [apps/web/lib/url-preview/ssrf.ts](apps/web/lib/url-preview/ssrf.ts): scheme allowlist + private-IP DNS rejection. Results land in the `url_previews` table (7d for successes, 1h for failures).

**Procedures don't redirect.** Server actions used `redirect()`; procedures return `{ redirectTo }` and the client navigates with `router.replace` (or `window.location.assign` when the cookie-clear behavior matters — e.g. account delete, signOutAndRedirect).

### App Router layout groups

| Group | Path | Purpose |
|---|---|---|
| `(auth)` | `/sign-in`, `/sign-up` | Unauthenticated shell |
| `(dashboard)` | `/dashboard`, `/settings` | Authenticated app shell |
| `(public)` | `/privacy`, `/help` | Public marketing-adjacent pages |
| `admin/` | `/admin/*` | Platform admin — separate from layout groups |

### Auth

Magic links (always on) plus optional Google OAuth. Session is cached for 5 minutes server-side via Better Auth's cookie cache. Admin access checks `user.role === 'platform_admin'` plus an optional `PLATFORM_ADMIN_HOST` subdomain match. When changing the Better Auth config, run `pnpm auth:generate` to keep the schema in sync.

Google sign-in is gated on `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — the button only renders when both are present. To enable: register an OAuth 2.0 Web client in [Google Cloud Console](https://console.cloud.google.com/apis/credentials), add `<BETTER_AUTH_URL>/api/auth/callback/google` as an authorized redirect URI (one entry per environment), then set the two env vars.

### Database schema

Core tables live in `apps/web/db/schema/`:
- `meals` — unique per `(userId, normalizedName)`; soft-deleted via `archivedAt` (always filter with `isNull(archivedAt)`). `recipe_source_url` is the canonical "where I got this recipe" field, rendered as a platform embed on the recipe view (R16).
- `mealLogs` — one log per cooking event; has `effortLevel` enum: `quick | easy | medium | high_effort`
- `analytics_events` — in-house event tracking
- `url_previews` — R16 cache of OG/Twitter-card metadata fetched server-side. Primary key is the URL itself; successful rows live 7d, failures 1h.
- `email_delivery` — Resend webhook delivery receipts
- `users.preferredTenantId` — scaffold column for future multi-tenancy; always null in current product logic. No `tenants` or `tenant_members` table exists yet.

Always run `pnpm db:generate` then `pnpm db:migrate` after schema changes. Never hand-edit files in `apps/web/drizzle/` (auto-generated migration history).

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
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | optional | Enables "Continue with Google" on sign-in/sign-up — **both or neither** |
| `PLATFORM_ADMIN_HOST` | optional | Restricts `/admin/*` to a specific subdomain |

All server-side env access goes through `apps/web/lib/env/server.ts` → `getServerEnv()`, which validates and caches at startup. Never read `process.env` directly in server code.

### Key patterns

- **`server-only`** — imported at the top of any module that must never reach the client bundle (`apps/web/services/`, `apps/web/lib/db/`, `apps/web/lib/auth/`, `apps/web/server/trpc/`). A build error surfaces immediately if the boundary is crossed.
- **Meal normalization** — `normalizedName` is `name.trim().toLowerCase()`. The unique index enforces one `meals` row per user per dish name; logging the same meal again creates a new `mealLogs` row against the existing `meals` row.
- **Observability** — `apps/web/lib/observability/` holds the analytics event logger and funnel-tracking helpers. Events are fire-and-forget inside procedures (not awaited) so a logging failure can't surface a procedure error.
- **Email fallback** — when `RESEND_API_KEY` is absent, `apps/web/lib/email/resend.ts` logs the email to the console instead of throwing. This keeps local dev functional without Resend credentials.
- **Security headers** — defined in `apps/web/next.config.ts` (CSP, X-Frame-Options DENY, Permissions-Policy). Do not add `<iframe>` embeds without updating the CSP.

### Adding a new tRPC procedure

1. Pick the domain router under `apps/web/server/trpc/routers/<domain>.ts`. If the domain doesn't exist, create the file + import it into `apps/web/server/trpc/app-router.ts`.
2. Compose the procedure builder. Examples:
   - Read: `householdMemberProcedure.input(schema).query(({ ctx, input }) => service(...))`
   - Write: `householdMemberProcedure.use(rateLimit("mutation")).input(schema).mutation(({ ctx, input }) => service(...))`
   - Paid-tier: `gatedProcedure("plans_create").input(...).mutation(...)`
3. Catch service-level errors at the procedure boundary and rethrow as `TRPCError` with a structured `cause` — `{ reason: "STRING_CONSTANT", … }`. Client side reads via `getCause(error)?.reason`. Keep `reason` strings stable; the UI keys copy off them.
4. From a client component, call `trpc.<domain>.<proc>.useQuery(input)` or `.useMutation()`. Use `trpc.useUtils().<domain>.<proc>.invalidate()` to refetch related queries after a related mutation.
5. For tests, mock services + use `createCallerFactory(router)(ctx)` — pattern in [apps/web/server/trpc/routers/routers.test.ts](apps/web/server/trpc/routers/routers.test.ts).
