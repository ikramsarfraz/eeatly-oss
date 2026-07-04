# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Round 12 restructured this into a pnpm-workspaces monorepo:

```
apps/
  web/        Next.js app — the eeatly web product
  mobile/     Expo + React Native — full client: magic-link auth, library,
              recipe detail, Refine, meal plans, household, AI capture,
              notifications, settings. Consumes the same tRPC AppRouter +
              validators as web via @eeatly/api.
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
pnpm test             # Run web tests once (Vitest)
pnpm test:watch       # Vitest in watch mode

pnpm db:generate      # Generate Drizzle migration from schema changes
pnpm db:migrate       # Apply migrations to Neon Postgres
pnpm db:studio        # Drizzle Studio GUI

pnpm auth:generate    # Regenerate Better Auth schema (run after auth config changes)
pnpm check:deploy     # Validate all required env vars are present
pnpm smoke:prod       # HTTP smoke tests against production
pnpm analyze          # Build with bundle analyzer (ANALYZE=true next build)
```

Run a single test file: `cd apps/web && pnpm exec vitest run path/to/file.test.ts`

Start the mobile Metro bundler (after the web dev server is running): `pnpm --filter @eeatly/mobile start`

To work directly inside a workspace, `cd apps/web && pnpm <script>` works too — but prefer the root commands so the right workspace is always selected.

Node 24.14.x and pnpm 10.33.x are required (enforced via `engines` at the root `package.json`).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4  
Better Auth v1.4 (magic links, Drizzle adapter) · Drizzle ORM + Neon serverless Postgres  
Resend + React Email · AWS S3 / Cloudflare R2 (photo uploads) · TanStack Query v5  
tRPC v11 + superjson (Round 11 — every client-driven interaction)

## Copy & writing style

- **No em dashes (`—`) in any user-facing copy.** This applies to every rendered string: marketing pages (landing, `/pricing`, `/privacy`, `/help`), settings, emails, toasts, button labels, page metadata/descriptions, FAQ answers, anywhere a user can read it. Rewrite with a comma, a period, parentheses, or a colon instead. Example: `"free, forever — within a monthly grant"` becomes `"free, forever, within a monthly grant"`. Em dashes inside code comments are fine; this rule is about product copy only.

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

### Row-Level Security (Round 37, phased rollout)

Postgres RLS is the DB-level backstop for the per-creator / personal-cook-history
isolation that services enforce in `WHERE` clauses. **Currently dormant**: it
activates only when `DATABASE_URL_APP` (a restricted, non-owner role) is set;
until then everything runs on the single owner connection unchanged.

- **Two clients** ([apps/web/lib/db/client.ts](apps/web/lib/db/client.ts)): `db`
  (restricted, RLS-enforced) is the default; `dbPrivileged` (owner, bypasses
  RLS) is for system paths only. `withRlsContext(userId, fn)` opens a tx, sets
  `app.current_user_id`, and scopes `db` to it via `AsyncLocalStorage`
  ([request-context.ts](apps/web/lib/db/request-context.ts)); `withPrivileged(fn)`
  routes `db` to the owner connection.
- **Wiring**: every authenticated tRPC procedure runs in `withRlsContext`;
  `adminProcedure` + Better Auth + cron + Stripe/Resend webhooks run
  `withPrivileged`. Authenticated server components + API route handlers wrap
  their data loads via `lib/auth/rls.ts` (`loadAuthed` / `loadHousehold` /
  `loadAdmin`); token-accept pages (`/invite`, `/connect`) use `withPrivileged`.
  AsyncLocalStorage does not propagate reliably across the RSC render tree, so
  each page wraps its own data-loading function, not a layout.
- **Policies** live in [apps/web/db/rls/](apps/web/db/rls/) (`*.sql`, kept out of
  the auto-generated `drizzle/` journal). Apply via `drizzle-kit generate
  --custom` (see the README runbook). Helper fns: `app_current_user()` (the GUC)
  and `app_user_households()` (SECURITY DEFINER, so it bypasses RLS and avoids
  policy recursion). Adding a table → add its policy to the matching phase file.
- **Gotcha**: with RLS on, an authenticated request runs in ONE transaction, so
  AI procedures hold a connection across the LLM call (idle-in-transaction risk)
  and per-request writes become atomic. See the README for the open decisions
  (AI procedures, `plans.ts` household-wide effort, `user`-table residual).

### Database schema

Core tables live in `apps/web/db/schema/`:
- `meals` — unique per `(householdId, createdByUserId, normalizedName)` (`0045`). The R4 household-wide unique index predated R32's per-item privacy: now two members can each privately own "chicken biryani" in the same kitchen. Joining a household never blocks, merges, renames, or exposes same-named meals — the joiner keeps full ownership and both copies coexist. Soft-deleted via `archivedAt` (always filter with `isNull(archivedAt)`). `recipe_source_url` is the canonical "where I got this recipe" field, rendered as a platform embed on the recipe view (R16).
- **Log-time meal resolution** (`createMealLog`, 0045): own row → row shared with the viewer (active grant) → insert a fresh own row. Another member's private same-named row is never matched. Recipe-field updates on a grant-matched row require an edit/admin grant; a view-only grantee's log records the cook but never rewrites the owner's recipe.
- **Cook history is personal.** Every log read (dashboard, /history rows + stats, `getMealDetail` cook count / last-cooked / modal effort) filters `mealLogs.cookedByUserId = viewer` on top of meal visibility — sharing a recipe or a kitchen never exposes another member's cooking dates, counts, log notes, or log photos. `deleteMealLog` is cook-only for the same reason. The intended effort-only exception (effort enum, no personal payload) is the plan-dish effort modal in `services/plans.ts`. NOTE: the `services/ai.ts` latest-log read (`generateShareableRecipe`) currently reads another member's log `notes`, not just effort, contrary to the rule. It is enforced by the `meal_logs` RLS policy (see **Row-Level Security**) rather than hand-patched. See [docs/audits/isolation-read-audit-2026-06.md](docs/audits/isolation-read-audit-2026-06.md).
- `recipe_variants` (`0044_recipe_variants.sql`) — alternate recipes for one dish, with `meal_ingredients.variant_id` / `recipe_steps.variant_id` scoping structured rows (`variant_id IS NULL` = the base recipe, so **every base-recipe read/delete on those tables must filter `isNull(variantId)`**). `getMealDetail` returns a `variants` array and both web recipe views render an Original/variant switcher when variants exist. Currently DORMANT: no flow writes variants (the household-join merge that originally motivated them was replaced by per-creator coexistence); the infra is kept for a future explicit "merge duplicates" user action.
- `mealLogs` — one log per cooking event; has `effortLevel` enum: `quick | easy | medium | high_effort`
- `analytics_events` — in-house event tracking
- `url_previews` — R16 cache of OG/Twitter-card metadata fetched server-side. Primary key is the URL itself; successful rows live 7d, failures 1h.
- `email_delivery` — Resend webhook delivery receipts
- `users.preferredTenantId` — scaffold column for future multi-tenancy; always null in current product logic. No `tenants` or `tenant_members` table exists yet.
- `meal_ingredients` (R18, `0026_structured_recipe.sql`) — structured per-row ingredient storage with `name`, `quantity_string` (free-form), `prep_note`, and explicit `position`. Sits alongside the legacy `meals.ingredients` text[]. New code writes here on Refine save; readers prefer rows when present, fall back to the legacy array when not.
- `recipe_steps` (R18, same migration) — structured steps with `title`, free-form `time` ("10 min · then 20 min rest"), `body`, and `ingredient_ids: text[]` referencing `meal_ingredients.id`. Legacy `meals.recipe_text` blob remains the fallback for unstructured recipes.
- **R19 read path**: `getMealDetail` now surfaces `structuredIngredients` + `structuredSteps` arrays alongside the legacy `ingredients: string[]` + `recipeText` fields. The mobile Recipe Detail screen prefers structured rows when present (cooks who've used the Refine flow at least once) and falls back to the legacy fields + a client-side parser when the rows are empty (legacy meals predating Refine).
- `refine_sessions` / `refine_turns` / `refine_pending_changes` (R18, `0027_refine_sessions.sql`) — back the chat-style "Refine recipe" editor. Per-device per-recipe-per-user; one active session at a time enforced by a partial unique index. See **Refine recipe** below.
- `plans` / `plan_dishes` (`apps/web/db/schema/plans.ts`) — meal planning. A plan is a named, ordered collection of dishes; each `plan_dishes` row points at a meal with a per-dish annotation and explicit ordering (`addDishToPlan` / `reorderDishes` / `updateDishAnnotation`, `clonePlanFromPast` duplicates a prior plan). Gated behind `plans_create`; the `services/plans.ts` + `routers/plans.ts` pair owns the domain.
- **Sharing & grants** (`apps/web/db/schema/sharing.ts` + `shares.ts`) — the privacy/visibility model the prose above relies on. `item_grants` (per-meal view/edit/admin grants between members), `recipe_shares` / `plan_shares` (link-based shares), `item_requests`, `connections` + `connection_invitations` (cross-household sharing), `share_tombstones` (revocation). When reasoning about "shared with me" reads or grant checks, start here.

Always run `pnpm db:generate` then `pnpm db:migrate` after schema changes. Never hand-edit files in `apps/web/drizzle/` (auto-generated migration history).

### Refine recipe (AI-prompted editing) — Round 18

A refine session is a per-device draft layered on top of a meal. The user prompts the AI (text / voice / photo); each prompt becomes a `refine_turn` row recording the proposed `PendingChange[]`; accepted turns aggregate into `refine_pending_changes`; the Save mutation applies them atomically to `meal_ingredients` / `recipe_steps` / `meals` and closes the session.

- **Lifecycle**: `active` → `saved` or `discarded`. A partial unique index on `(meal_id, user_id, device_id) WHERE status = 'active'` enforces one in-progress session per device per recipe.
- **Authorization**: sessions are user-scoped — household members do **not** share refine drafts. Service-layer `requireHouseholdMember` runs against the meal's household at session start; every subsequent procedure asserts session ownership.
- **AI service**: `apps/web/services/ai-refine.ts` (text / voice / photo). Reuses the provider fallback (`withFallback`) + Whisper transcription. Different prompt from Capture: Refine diffs against an existing recipe; Capture extracts from scratch. Same `PendingChange[]` wire shape between client + AI + DB.
- **Heads-up rules**: `apps/web/lib/refine/heads-up-rules.ts` — pure functions over `(recipe, changes)`. Four rules ship in v1 (heavy-ingredient quantity bump, bulk ingredient growth, long new step time, empty quantity). Not AI-generated.
- **Idempotency on save**: a save with zero pending changes is a no-op + close; a save on an already-saved session rejects with `CONFLICT`. Last-write-wins between concurrent sessions on different devices — `meal_version` snapshotting is parked for v2.

### Environment variables

All server-side env access goes through `apps/web/lib/env/server.ts` → `getServerEnv()`, which validates and caches at startup. Never read `process.env` directly in server code. Copy `apps/web/.env.example` to `apps/web/.env.local` as a starting point.

| Var | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon pooled connection string (owner role; `dbPrivileged` + migrations) |
| `DATABASE_URL_APP` | optional | Restricted RLS role for app queries. Unset = RLS dormant (falls back to `DATABASE_URL`). See **Row-Level Security** |
| `BETTER_AUTH_SECRET` | ✅ | ≥32 chars, signs sessions |
| `BETTER_AUTH_URL` | ✅ | App origin (e.g. `https://eeatly.app`) |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public origin (the only `NEXT_PUBLIC_` var) |
| `ANTHROPIC_API_KEY` | ✅ | AI provider (Refine, Capture, share copy) |
| `OPENAI_API_KEY` | ✅ | AI provider (primary) + Whisper transcription |
| `RESEND_API_KEY` + `EMAIL_FROM` | optional | Magic link email; falls back to console.log |
| `RESEND_WEBHOOK_SECRET` | optional | Email delivery tracking |
| R2 group (5 vars) | optional | Photo uploads — **all five must be set or none** |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | optional | Enables "Continue with Google" — **both or neither** |
| `PLATFORM_ADMIN_HOST` | optional | Restricts `/admin/*` to a specific subdomain |
| `GEMINI_API_KEY` | optional | Dish image generation (Gemini 2.5 Flash); falls back to gpt-image-1 |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | optional | Rate limiting — no-ops in local dev when unset, enforced in uat/prod |
| `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` + `STRIPE_WEBHOOK_SECRET` | optional | Billing — **all three or none** |
| `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` | optional | Error tracking |
| `SENTRY_AUTH_TOKEN` | optional | Source-map upload at build time only |
| `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` + `NEXT_PUBLIC_POSTHOG_HOST` | optional | Product analytics |

### Key patterns

- **`server-only`** — imported at the top of any module that must never reach the client bundle (`apps/web/services/`, `apps/web/lib/db/`, `apps/web/lib/auth/`, `apps/web/server/trpc/`). A build error surfaces immediately if the boundary is crossed.
- **Meal normalization** — `normalizedName` is `name.trim().toLowerCase()`. The unique index enforces one `meals` row per user per dish name; logging the same meal again creates a new `mealLogs` row against the existing `meals` row.
- **AI provider fallback** — `withFallback(primary, fallback, ctx)` in `apps/web/lib/ai/providers/index.ts`. OpenAI is the primary provider; Anthropic is the fallback. Auth errors (401/403) are rethrown immediately without retrying — they indicate a config bug, not a transient failure. All AI services (`apps/web/services/ai.ts`, `ai-refine.ts`) use this pattern.
- **Billing tiers** — free / plus / pro (see `apps/web/lib/pricing.ts`, the single source of truth for display amounts and credit grants). New sign-ups get a 7-day Pro trial automatically based on `createdAt` — no extra column. Display prices are hardcoded in `lib/pricing.ts`, not env-driven; Stripe Price IDs come from env vars in `services/billing.ts`. Stripe amounts must match `lib/pricing.ts` manually.
- **Feature gates** — `FEATURE_REGISTRY` in `packages/api/src/gates/registry.ts` maps every gated key to a `defaultRule`. Enforce server-side with `requireFeatureAccess(userId, key)` at the service boundary; use `gatedProcedure("key")` at the procedure layer. Override rules stored in `feature_overrides` win over defaults; admin role wins over everything.
- **Observability** — `apps/web/lib/observability/` holds the analytics event logger and funnel-tracking helpers. Events are fire-and-forget inside procedures (not awaited) so a logging failure can't surface a procedure error.
- **Email fallback** — when `RESEND_API_KEY` is absent, `apps/web/lib/email/resend.ts` logs the email to the console instead of throwing. This keeps local dev functional without Resend credentials.
- **Security headers** — defined in `apps/web/next.config.ts` (CSP, X-Frame-Options DENY, Permissions-Policy). Do not add `<iframe>` embeds without updating the CSP.
- **Middleware** — `apps/web/proxy.ts` is the Next.js middleware (adds `x-request-id` correlation headers, enforces admin-subdomain path routing, sets `X-Robots-Tag: noindex` on non-public paths).

### Adding a new tRPC procedure

1. Pick the domain router under `apps/web/server/trpc/routers/<domain>.ts`. If the domain doesn't exist, create the file + import it into `apps/web/server/trpc/app-router.ts`.
2. Compose the procedure builder. Examples:
   - Read: `householdMemberProcedure.input(schema).query(({ ctx, input }) => service(...))`
   - Write: `householdMemberProcedure.use(rateLimit("mutation")).input(schema).mutation(({ ctx, input }) => service(...))`
   - Paid-tier: `gatedProcedure("plans_create").input(...).mutation(...)`
3. Catch service-level errors at the procedure boundary and rethrow as `TRPCError` with a structured `cause` — `{ reason: "STRING_CONSTANT", … }`. Client side reads via `getCause(error)?.reason`. Keep `reason` strings stable; the UI keys copy off them.
4. From a client component, call `trpc.<domain>.<proc>.useQuery(input)` or `.useMutation()`. Use `trpc.useUtils().<domain>.<proc>.invalidate()` to refetch related queries after a related mutation.
5. For tests, mock services + use `createCallerFactory(router)(ctx)` — pattern in [apps/web/server/trpc/routers/routers.test.ts](apps/web/server/trpc/routers/routers.test.ts).

### Mobile design system (R19)

- **Tokens** live in `apps/mobile/tailwind.config.js` (NativeWind classes) and `apps/mobile/lib/design/tokens.ts` (raw hex constants for RN APIs that take string colors directly — `Ionicons` tint, `ActivityIndicator`, status bar). Every semantic token has a sibling `-dark` value in both places. **Source of truth for design**: `docs/design/eeatly-redesign/` (committed in R18).
- **Dark mode** is wired via `darkMode: 'media'` in tailwind.config.js. Components use the `dark:` variant prefix for class-based colors (`bg-cream dark:bg-cream-dark text-ink dark:text-ink-dark`). Inline-style callsites that need a hex string read from `useThemeColors()` (`apps/mobile/lib/design/use-theme-colors.ts`) — same key shape as the light palette, retuned for warm-near-black.
- **Fonts** load through `expo-font` + `@expo-google-fonts/instrument-serif`, `@expo-google-fonts/geist`, `@expo-google-fonts/jetbrains-mono`. Loader hook: `apps/mobile/lib/design/use-app-fonts.ts`. Root `_layout.tsx` gates the Stack render on the font-loaded flag so the first paint is never in a system fallback.
- **Recipe Detail rendering** (R19, `apps/mobile/app/(authed)/meal/[id]/index.tsx`): prefers the structured `mealIngredients` + `recipeSteps` rows from `getMealDetail` when populated; falls back to client-side parsing of the legacy `meals.ingredients` text[] + `recipeText` blob when empty. The fallback path remains intact for every legacy meal in the database — no batch migration required.
