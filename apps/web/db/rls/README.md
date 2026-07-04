# Row-Level Security retrofit — operator runbook

This directory holds the RLS policy SQL. The app-side plumbing is already merged
and **dormant**: until `DATABASE_URL_APP` is set, everything runs on the single
privileged connection exactly as before. Turning RLS on is a deliberate,
staged operation described here.

Background: [docs/audits/isolation-read-audit-2026-06.md](../../../../docs/audits/isolation-read-audit-2026-06.md).

## What is already in the codebase (dormant)

- **Dual client** ([lib/db/client.ts](../../lib/db/client.ts)): `db` (restricted),
  `dbPrivileged` (owner), `withRlsContext(userId, fn)`, `withPrivileged(fn)`.
  Routing is driven by an `AsyncLocalStorage` scope
  ([lib/db/request-context.ts](../../lib/db/request-context.ts)).
- **tRPC** ([server/trpc/trpc.ts](../../server/trpc/trpc.ts)): every authenticated
  procedure runs inside `withRlsContext`; `adminProcedure` runs `withPrivileged`.
- **Better Auth + system handlers** run `withPrivileged` (auth route, cron,
  Stripe + Resend webhooks).
- **Env**: `DATABASE_URL_APP` (optional) selects the restricted role.

## Apply order

Apply the SQL files **in numeric order**, testing between each. They are written
to run as the **table owner** (`DATABASE_URL`).

1. `01_roles_and_helpers.sql` — grants + `app_current_user()` / `app_user_households()`. No RLS yet.
2. `02_per_user_policies.sql` — per-user tables.
3. `03_household_and_children_policies.sql` — meals/plans + children + household + shares + indexes.
4. `04_meallogs_grants_global_policies.sql` — meal_logs, grants/connections, caches, admin/auth lockdown.

### Turning these into migrations

They are kept out of `drizzle/` (which is auto-generated — never hand-edit) on
purpose. To apply, either:

- **Custom migration (preferred, tracked):** for each file,
  `pnpm db:generate -- --custom --name=rls_<phase>` to scaffold an empty
  numbered migration, then paste the SQL in. Commit. `pnpm db:migrate` applies
  it.
- **Direct psql (for a controlled rollout):** run each file against the DB as
  the owner. Track which were applied yourself.

## One-time role provisioning

Run as the owner, before file 01 (the grants in 01 reference the role):

```sql
CREATE ROLE eeatly_app LOGIN PASSWORD '<from-secrets-manager>';
-- Must NOT be a table owner and MUST NOT have BYPASSRLS.
```

On Neon: create a second role in the console (or via SQL), then build a
connection string for it and set `DATABASE_URL_APP` to that string. Keep
`DATABASE_URL` pointed at the owner role.

## Server-component + route wiring — DONE (R37)

Setting the env makes `db` resolve to the restricted role. Any authenticated DB
read NOT inside `withRlsContext` then returns **zero rows**. All known call
sites are now wrapped via the helpers in `lib/auth/rls.ts` (`loadAuthed` /
`loadHousehold` for user reads, `loadAdmin` for admin) plus `withPrivileged` for
token-accept flows. The inventory below records what was wrapped — re-verify it
when you add new authenticated pages or routes.

### A. Authenticated server components → wrap data loads in `withRlsContext(user.id, …)`

```
app/(dashboard)/add/page.tsx            app/(dashboard)/notifications/page.tsx
app/(dashboard)/home/page.tsx           app/(dashboard)/people/page.tsx
app/(dashboard)/ideas/page.tsx          app/(dashboard)/plans/page.tsx
app/(dashboard)/kitchen/page.tsx        app/(dashboard)/plans/[id]/page.tsx
app/(dashboard)/library/page.tsx        app/(dashboard)/search/page.tsx
app/(dashboard)/meal/[id]/page.tsx      app/(dashboard)/settings/page.tsx
app/(dashboard)/meal/[id]/edit/page.tsx app/(dashboard)/settings/account/page.tsx
app/(dashboard)/layout.tsx              app/(dashboard)/settings/kitchen/page.tsx
app/(dashboard)/settings/layout.tsx
app/onboarding/page.tsx   app/connect/[token]/page.tsx   app/invite/[token]/page.tsx
```

> NOTE: AsyncLocalStorage does NOT reliably propagate across React's RSC render
> tree. Wrap the *data-loading function* in each page (the part that calls
> services) — do not rely on a single layout-level wrapper covering child
> components.

### B. Authenticated API route handlers → `withRlsContext`

```
app/api/account/export/route.ts   app/api/meals/route.ts   app/api/uploads/presign/route.ts
```

### C. Admin server components → `withPrivileged`

```
app/admin/layout.tsx  app/admin/users/page.tsx  app/admin/analytics/page.tsx
app/admin/billing/page.tsx  app/admin/emails/page.tsx  app/admin/feedback/page.tsx
app/admin/ai-usage/page.tsx  app/admin/features/page.tsx  app/admin/features/[feature]/page.tsx
```

### D. Already correct (no change)

- All tRPC procedures; `app/api/auth/[...all]`, cron, Stripe + Resend webhooks.
- Public token reads (`app/share/[token]`) use the narrow guard-free read path
  in `lib/share/*` — confirm it keeps using a privileged/own pool, not the
  restricted role.

## Behavior decisions to confirm

- **`services/plans.ts` plan-dish effort (`getPlanEffortAggregate`).** RESOLVED:
  this read now runs on `dbPrivileged` to preserve its documented household-wide
  effort fallback; per-creator visibility stays enforced by the explicit
  `mealVisibilityFilter` in the query.
- **AI procedures hold a transaction across LLM calls.** With RLS on, an
  authenticated request runs in one transaction for its whole duration. AI
  procedures (`services/ai.ts`, `ai-refine.ts`) call the LLM mid-request, which
  would hold a Postgres connection open for seconds (idle-in-transaction risk at
  scale). Before enabling in prod, decide per-procedure: snapshot the needed
  rows quickly then release, or accept the hold with a tuned
  `idle_in_transaction_session_timeout`.
- **`item_grants` admin re-share** and **household member management** writes use
  owner-scoped policies; if `cooksCanReshare` / owner-removes-member run on the
  restricted role, widen those policies or route through `dbPrivileged`.
- **`user` table** stays app-readable for name joins (residual: app role can read
  all user rows incl. email). Optional column-grant hardening is noted at the
  bottom of `04_*.sql`.

## Verify (per phase + before flip)

```
ITEST_DB=1 pnpm exec vitest run services/sharing-kitchen-itest.test.ts
```

The integration test ([../../services/sharing-kitchen-itest.test.ts](../../services/sharing-kitchen-itest.test.ts))
seeds two users in different households + a grant and asserts, under the
restricted role: a non-owner can't read another's private meal (0 rows), their
`meal_logs` are invisible, a granted recipe IS visible, and `dbPrivileged` still
sees system tables. Also run `EXPLAIN ANALYZE` on the dashboard meals-list +
history queries under the restricted role and confirm the phase-3 indexes are
used.

## Rollback

`DATABASE_URL_APP` unset → app instantly reverts to the privileged connection
(RLS dormant). Policies can stay in place (they only bind the restricted role).
To fully remove: `ALTER TABLE <t> DISABLE ROW LEVEL SECURITY` + `DROP POLICY`.
