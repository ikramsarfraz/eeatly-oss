# Public Beta Launch Checklist

Work through this in order. Each section depends on the previous one being complete.

---

## 1. Pre-Launch Infrastructure

### Neon Postgres
- [ ] Create a Neon project (or confirm existing project is for production, not dev)
- [ ] Copy the **pooled / serverless** connection string — this is `DATABASE_URL`
- [ ] Confirm the database is in a region close to your Vercel deployment

### Vercel Project
- [ ] Import the Git repository into Vercel
- [ ] Confirm **Install Command**: `pnpm install --frozen-lockfile`
- [ ] Confirm **Build Command**: `pnpm build`
- [ ] Set the production branch (usually `main`)

### Environment Variables (Vercel → Settings → Environment Variables)
Set these for the **Production** environment:

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon pooled URL |
| `BETTER_AUTH_SECRET` | ✅ | 32+ random chars — generate with `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | ✅ | Your production domain, e.g. `https://eeatly.app` |
| `NEXT_PUBLIC_APP_URL` | ✅ | Same production domain |
| `RESEND_API_KEY` | ✅ for email | From Resend dashboard |
| `EMAIL_FROM` | ✅ for email | Verified sender address |
| `RESEND_WEBHOOK_SECRET` | Optional | `whsec_…` from Resend webhook config |
| `R2_ACCOUNT_ID` | Optional | All R2 vars required together for photo upload |
| `R2_ACCESS_KEY_ID` | Optional | |
| `R2_SECRET_ACCESS_KEY` | Optional | |
| `R2_BUCKET` | Optional | |
| `R2_PUBLIC_BASE_URL` | Optional | |
| `PLATFORM_ADMIN_HOST` | Optional | Restrict `/admin/*` to a specific hostname |

---

## 2. Migration Order

Run migrations **before** the first deployment receives traffic. Schema must match the code.

```bash
# From a trusted machine with the production DATABASE_URL loaded:
pnpm db:migrate
```

Confirm it completes without errors. If any migration fails, do not proceed to deploy.

---

## 3. First Deployment

- [ ] Trigger a production deployment in Vercel (or promote from Preview)
- [ ] Wait for the build to succeed
- [ ] Confirm the deployment URL resolves

---

## 4. Resend Webhook Verification

Skip if `RESEND_WEBHOOK_SECRET` is not set yet — email sends will still work, but delivery tracking will not.

- [ ] In the Resend dashboard, create a webhook pointing to `https://<your-domain>/api/webhooks/resend`
- [ ] Enable these events: `email.sent`, `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`, `email.failed`, `email.delivery_delayed`, `email.suppressed`
- [ ] Copy the signing secret (`whsec_…`) and add it to Vercel as `RESEND_WEBHOOK_SECRET`
- [ ] Redeploy or trigger a new deployment to pick up the new env var
- [ ] Send a test magic link and confirm a row appears in `/admin/emails`

---

## 5. Admin Account Setup

After the first user signs up (or signs in), promote them to `platform_admin` via SQL:

```sql
UPDATE "user"
SET role = 'platform_admin'
WHERE email = 'your-admin-email@example.com';
```

Run this against the production database using the Neon SQL editor or a database client with the production `DATABASE_URL`.

- [ ] Promote admin account
- [ ] Sign in as that account and confirm `/admin/analytics`, `/admin/users`, `/admin/feedback`, `/admin/emails` all load without errors

---

## 6. Deployment Readiness Commands

Run these with production environment variables loaded:

```bash
pnpm check:deploy          # Validates all required env vars are present
pnpm smoke:prod -- --base-url https://<your-domain>  # HTTP smoke tests
```

`pnpm smoke:prod` checks:
- Public pages return 200
- Protected routes redirect (not 200) when unauthenticated
- Admin routes are not accessible anonymously
- Webhook rejects unsigned POST requests

- [ ] `pnpm check:deploy` passes cleanly
- [ ] `pnpm smoke:prod` passes cleanly

---

## 7. First-User Smoke Test (Manual)

Do this yourself with a real email before inviting anyone:

- [ ] Visit the landing page — copy reads correctly, no placeholder text visible
- [ ] Click "Start free" — sign-up flow works, magic link email arrives
- [ ] Click the magic link — lands on dashboard, not an error page
- [ ] Log a meal — appears in Recent meals immediately
- [ ] Log the same meal again using "Log again" — works without reloading
- [ ] Visit History — meal appears in Recent and Most cooked tabs
- [ ] Open Settings — name and email show correctly
- [ ] Send feedback — confirmation toast appears, row visible in `/admin/feedback`
- [ ] Sign out — redirected to sign-in, dashboard is inaccessible without signing back in
- [ ] Visit `/privacy` and `/help` — both pages render without errors

---

## 8. Rollback Checklist

If something is broken after deployment:

1. **Revert to previous deployment** in Vercel (Deployments → promote previous)
2. **Check if a migration caused it** — if the new code requires schema changes that were not applied, or applied incorrectly
3. **Do not run rollback migrations automatically** — assess whether data was written under the new schema before deciding to revert schema changes
4. **Check env vars** — a missing or incorrect variable is the most common cause of post-deploy failures; check Vercel function logs

---

## 9. First-Week Monitoring Checklist

Check these daily during the first week:

### Delivery Health
- [ ] `/admin/emails` — no unusual bounce or complaint rate
- [ ] Resend dashboard — webhook shows recent successful deliveries (HTTP 200)

### Activation
- [ ] `/admin/analytics` — `signed_up` vs `first_meal_logged` funnel — what share of signups log a first meal?
- [ ] `/admin/users` — any users stuck in "New" state after 24+ hours?

### Errors
- [ ] Vercel function logs — any 5xx errors or unhandled exceptions?
- [ ] `/admin/feedback` — any bug reports from early users?

### Retention Signal (after day 3+)
- [ ] `/admin/analytics` — `second_meal_logged` count growing?
- [ ] `/admin/users` — "At risk" count relative to total signups

### When to pause invites
- Bounce rate above 5% on magic link emails → check `EMAIL_FROM` domain verification
- Multiple users reporting they can't sign in → check `BETTER_AUTH_URL` matches actual domain
- `/admin/feedback` accumulating confusion reports on the same flow → fix before inviting more users

---

## Related Docs

- [docs/production-smoke-test.md](production-smoke-test.md) — detailed smoke test procedure
- [docs/beta-launch-runbook.md](beta-launch-runbook.md) — first 24 hours and ongoing beta ops
