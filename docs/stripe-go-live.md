# Stripe go-live runbook — turning paid Plus on

The app is built to flip from **launch mode** (Plus free for everyone) to
**paid checkout** with no code change — it's driven entirely by the
`STRIPE_*` environment variables. This runbook is the exact sequence to
run once the LLC + Stripe account are ready.

## How the toggle works

`isLaunchFreeAccess()` ([apps/web/lib/env/server.ts](../apps/web/lib/env/server.ts)):

- **No `STRIPE_*` vars set** → launch mode ON → the gate resolver grants
  all `beta_or_paid` / `paid_only` features to everyone; pricing pages
  show "Free during launch".
- **All 5 `STRIPE_*` vars set** → launch mode OFF automatically → gates
  enforce paid; the pricing card fires real Stripe Checkout.
- `LAUNCH_FREE_ACCESS=false` is the kill-switch; `=true` force-keeps the
  promo on even with Stripe configured.

The whole payment path already exists and is tested: lazy client
([lib/stripe/client.ts](../apps/web/lib/stripe/client.ts)), checkout +
portal ([services/billing.ts](../apps/web/services/billing.ts),
[server/trpc/routers/billing.ts](../apps/web/server/trpc/routers/billing.ts)),
and a signature-verified, idempotent webhook
([app/api/webhooks/stripe/route.ts](../apps/web/app/api/webhooks/stripe/route.ts)).
DB tables come from migration `0021_subscriptions.sql`.

## Pre-flight (do once the LLC exists)

1. **Stripe account** activated under the LLC (live mode enabled).
2. **Confirm the DB migration is applied** to production Neon:
   `pnpm db:migrate` — the `subscriptions` + `stripe_webhook_receipts`
   tables and the denormalized `users.stripe*` columns must exist.

## Step 1 — Stripe Dashboard setup

1. **Product + Prices.** Create one Product ("eeatly Plus") with two
   **recurring** Prices:
   - Monthly: **$5.00 / month**
   - Annual: **$50.00 / year**
   ⚠️ These amounts **must match** `PRICING` in
   [apps/web/lib/pricing.ts](../apps/web/lib/pricing.ts) ($5 / $50).
   Nothing reconciles them — a mismatch shows one price and charges
   another. If you change the price, update that file (and its test) too.
   Copy each Price ID (`price_…`).
2. **Customer Portal.** Billing → Customer portal → enable it (allow plan
   switch + cancellation). The "Manage billing" button uses it.
3. **Webhook endpoint.** Developers → Webhooks → add endpoint:
   - URL: `https://<your-prod-host>/api/webhooks/stripe`
   - Events: `checkout.session.completed`,
     `customer.subscription.created`, `customer.subscription.updated`,
     `customer.subscription.deleted`, `invoice.payment_succeeded`,
     `invoice.payment_failed`.
   - Copy the **signing secret** (`whsec_…`).

## Step 2 — Launch coupon for early users (no grandfathering)

**Decision (locked): reward, don't gift.** Nobody is free-forever. When
Stripe turns on, every launch user is gated like any free user and must
subscribe to keep Plus — but they get a generous launch discount so the
early base still feels rewarded, and you capture revenue instead of
giving the product away permanently.

> ⚠️ Do **not** run the `beta_2026` backfill — assigning a cohort would
> re-grant free Plus indefinitely and defeat this. Leave `beta_cohort`
> NULL for everyone (it already is).

1. **Create the coupon** in Stripe → Products → Coupons. Pick the terms
   you want, e.g.:
   - "3 months free" — percent-off 100% for a duration of 3 months, or
   - "50% off for 12 months" — percent-off 50%, duration repeating 12mo.
2. **Create a Promotion Code** for that coupon (a human-friendly code
   like `LAUNCH`). The Checkout session already sets
   `allow_promotion_codes: true`, so users just type it at checkout —
   no code change needed.
3. **Email the launch cohort** at flip: "Plus is now paid — here's `LAUNCH`
   for <terms> as a thank-you for being early." (Pull the list from
   `SELECT email FROM users` filtered to your real signups.)

Optional polish (future, not required): pass `discounts: [{ coupon }]`
into `createCheckoutSession` to auto-apply the code instead of having
users type it — note that Stripe makes `discounts` and
`allow_promotion_codes` mutually exclusive per session.

## Step 3 — Set env vars + deploy

Set in the **Production** Vercel environment (not Preview):

```
STRIPE_SECRET_KEY=sk_live_…
STRIPE_PUBLISHABLE_KEY=pk_live_…
STRIPE_WEBHOOK_SECRET=whsec_…
STRIPE_PRICE_MONTHLY=price_…      # the $5/mo Price ID
STRIPE_PRICE_ANNUAL=price_…       # the $50/yr Price ID
```

Then verify and deploy:

```bash
pnpm check:deploy   # must read: "Stripe: fully configured"
                    # (a PARTIAL config hard-fails this check)
```

Redeploy so the new env vars take effect.

## Step 4 — Verify the flip

1. `pnpm check:deploy` → `Stripe: fully configured … launch free-access auto-disabled`.
2. **Any account** (launch users are gated like everyone now): a gated
   feature (AI suggest, create household, share recipe) shows the upgrade
   prompt; the `/pricing` card shows **$5 / mo · $50 / yr** with a working
   "Upgrade to Plus" → Stripe Checkout.
3. Complete a checkout **with the promotion code** (use a live card or a
   Stripe test card in test mode first) and confirm the discount applies
   on the Checkout page. On return to `/settings?upgraded=true` you see
   the success toast; within a few seconds the plan reads **Plus** (the
   webhook wrote the `subscriptions` row).
4. Stripe Dashboard → Webhooks → confirm the endpoint shows `200`
   responses for the `checkout.session.completed` +
   `customer.subscription.created` events.
5. "Manage billing" from Settings opens the Stripe Customer Portal.

## Rollback (instant, no deploy code change)

Either of these returns the app to launch mode immediately on redeploy:

- Set `LAUNCH_FREE_ACCESS=true` (keeps Stripe wired but unlocks everyone), or
- Unset the `STRIPE_*` vars.

Subscriptions already created in Stripe are unaffected; they simply stop
being *required* for access while the promo is back on.
