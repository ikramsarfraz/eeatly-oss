# Production smoke test

Use this checklist after each deploy (and before inviting beta users). Pair with `pnpm check:deploy` and `pnpm smoke:prod`.

## Deploy checklist (before traffic)

1. **Branch / tag** — Deploy from a known commit (e.g. `main` at green CI).
2. **Environment** — All [Vercel env checklist](#vercel-environment-checklist) items set for **Production** (and Preview if you test there).
3. **Database** — [Neon migration checklist](#neon-migration-checklist) complete for this release.
4. **Email** — [Resend webhook checklist](#resend-webhook-checklist) for the production URL.
5. **Automated checks** — From the repo root (with `.env.local` or exported env for `check:deploy`):

   ```bash
   pnpm check:deploy
   pnpm smoke:prod -- --base-url https://your-production-origin
   ```

6. **Admin** — At least one `platform_admin` user exists; see [Confirm admin access](#confirm-admin-access).

---

## Vercel environment checklist

Set in the Vercel project → Settings → Environment Variables (Production unless noted).

| Variable | Notes |
|----------|--------|
| `DATABASE_URL` | Neon pooled / serverless URL. |
| `BETTER_AUTH_SECRET` | ≥ 32 characters; unique per environment. |
| `BETTER_AUTH_URL` | **Must match** the deployed site origin (e.g. `https://app.example.com`). |
| `NEXT_PUBLIC_APP_URL` | Same public origin as the site (used for metadata and client-safe URLs). |
| `RESEND_API_KEY` / `EMAIL_FROM` | Required for magic-link email in production. |
| `RESEND_WEBHOOK_SECRET` | Signing secret (`whsec_…`) for `/api/webhooks/resend`. |
| `R2_*` | Either **all** R2 variables for photo uploads, or leave all unset to disable uploads with a clear config error. |
| `PLATFORM_ADMIN_HOST` | Optional; if set, `/admin/*` only resolves when `Host` matches (use with a dedicated admin hostname). |

**Security:** Do not put server secrets in `NEXT_PUBLIC_*`. CookLoop only exposes `NEXT_PUBLIC_APP_URL` to the browser.

---

## Neon migration checklist

Migrations **do not run** during `pnpm build` on Vercel unless you add a custom step—by design, apply them from a trusted environment:

1. Ensure `DATABASE_URL` in Vercel matches the database you are migrating.
2. From a machine with repo access and env loaded:

   ```bash
   pnpm db:migrate
   ```

3. Run after deploy when the new migration files are on the branch you ship—or run immediately before first traffic if the deploy adds schema.

4. For rollbacks, restore a DB backup or run a **forward** migration only; avoid hand-editing prod data without a runbook.

---

## Resend webhook checklist

1. HTTPS URL reachable: `https://<your-app>/api/webhooks/resend`.
2. Dashboard webhook includes email lifecycle events (sent, delivered, opened, clicked, bounced, etc.).
3. `RESEND_WEBHOOK_SECRET` matches the signing secret in Resend.
4. Test: send one email, confirm `/admin/emails` and `email_*` events in `/admin/analytics`.

---

## Auth smoke test (manual)

1. Open `/sign-in`, request a magic link with a test inbox.
2. Complete sign-in; confirm redirect to `/dashboard`.
3. Sign out (or use incognito) and confirm `/dashboard` redirects unauthenticated users to `/sign-in`.

---

## Meal logging smoke test (manual)

1. As a signed-in user, submit the dashboard quick log.
2. Confirm the meal appears on the dashboard and on **History**.
3. Log the same meal again and confirm the repeat / count behavior matches expectations.

---

## Feedback smoke test (manual)

1. Submit feedback from the app shell or Settings.
2. As `platform_admin`, open `/admin/feedback` and confirm the entry appears.

---

## Admin analytics / users / emails smoke test (manual)

1. **`/admin/analytics`** — Loads aggregates without errors; charts/tables render.
2. **`/admin/users`** — Roster loads; segment filters work.
3. **`/admin/emails`** — Table loads (may be empty until mail is sent).

If `PLATFORM_ADMIN_HOST` is set, open admin **only** on that host; otherwise you will see `404`.

---

## Automated smoke CLI (no login)

```bash
pnpm smoke:prod -- --base-url https://your-production-origin
```

This verifies public pages return **200**, protected routes **redirect** when unauthenticated, admin routes are **not** returned as **200** without a session (redirect or **404**), and the webhook route **rejects** unsigned `POST` (typically **400**, **401**, or **503** if the webhook secret is unset).

---

## Rollback notes

1. **Vercel** — Promote a previous deployment or redeploy a known-good commit.
2. **Database** — Migrations are one-way in tooling; roll forward with a fix migration or restore from backup—plan before risky schema changes.
3. **Secrets** — Rotating `BETTER_AUTH_SECRET` invalidates existing sessions; coordinate with users if you must rotate.

---

## Related commands

| Command | Purpose |
|---------|---------|
| `pnpm check:deploy` | Validate required env (loads `.env.local` / `.env` when present). |
| `pnpm smoke:prod -- --base-url <url>` | HTTP checks against a running deployment. |
| `pnpm db:migrate` | Apply Drizzle migrations to the database pointed at by `DATABASE_URL`. |
