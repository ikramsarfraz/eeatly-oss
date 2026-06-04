# Stripe integration — end-to-end testing

Two layers. The first runs here; the second needs a Stripe test account + a
running app and is done with the Stripe CLI.

## 1. Automated — webhook + credits engine against the real DB

`apps/web/services/stripe-e2e.test.ts` drives the **actual** `ingestStripeEvent`
handler and the credit engine against the live Neon database (no mocks), then
cleans up. It covers:

- free user → free tier + 15 monthly credits
- `withAiCredits` consume (per-op cost) + refund-on-failure
- one-time credit Checkout → `grantPurchasedCredits` (idempotent on replay)
- `customer.subscription.created` (Pro price) → `subscriptions.tier = 'pro'`,
  monthly grant bumped to 1,500, purchased top-ups preserved
- out-of-credits → `InsufficientCreditsError` + ledger has consume/refund/purchase

Run it (needs `.env.local` with `DATABASE_URL`):

```bash
pnpm --filter @eeatly/web test:e2e:stripe
```

It's gated behind `E2E_STRIPE` and skipped in the normal `pnpm test` run.

Also covered by the mocked suites: `services/billing.test.ts` (webhook
idempotency + status/tier mapping), `services/ai-credits.test.ts` (tier
resolution, purchase idempotency, deduct/insufficient), `routers.test.ts`
(checkout + credits wiring).

## 2. Manual — Stripe-hosted Checkout (browser) via the Stripe CLI

The Stripe-hosted checkout page can't be automated headlessly. Do this against
Stripe **test mode**.

### One-time setup

The sellable catalog is **synced live from Stripe** (`services/stripe-catalog.ts`),
not configured via env. You tag each Price with metadata and the app discovers
them. Only the three core Stripe keys go in `apps/web/.env.local`:
`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.

1. Create 6 test-mode Prices and **tag each with metadata** (amounts must match
   the credit math; tiers are **recurring**, credit packs are **one-time**):
   - Plus monthly $5 → `metadata.plan=plus`, `metadata.interval=month`
   - Plus annual $50 → `metadata.plan=plus`, `metadata.interval=year`
   - Pro monthly $12 → `metadata.plan=pro`, `metadata.interval=month`
   - Pro annual $120 → `metadata.plan=pro`, `metadata.interval=year`
   - Credits $5 → `metadata.kind=credits`, `metadata.credits=200`
   - Credits $10 → `metadata.kind=credits`, `metadata.credits=500`

   Via CLI, e.g.: `stripe prices update <price_id> -d "metadata[plan]=pro" -d "metadata[interval]=month"`.
   (To add/retire a tier or pack later, just edit Stripe — no code or env change.)
2. Set `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`.
3. Start the app: `pnpm dev` (port 3003).
4. Forward webhooks and copy the printed `whsec_…` into `STRIPE_WEBHOOK_SECRET`, then restart:

```bash
stripe listen --forward-to localhost:3003/api/webhooks/stripe
```

The catalog is cached ~5 min in-process; restart the dev server (or wait) after
editing Prices in Stripe to see changes.

### Flows to verify

1. **Subscribe to Plus** — `/pricing` → Plus → Upgrade → pay with `4242 4242 4242 4242`.
   After redirect: Settings shows the plan; `subscriptions.tier = 'plus'`;
   AI-credits card shows 300 monthly.
2. **Upgrade to Pro** — `/pricing` → Pro → checkout. Tier flips to `pro`, monthly grant bumps to 1,500.
3. **Buy a credit pack** — Settings → AI credits → "200 credits · $5" → checkout.
   Return to `/settings?credits=true`; top-up balance +200 (rolls over, never resets).
4. **Spend credits** — run AI prefill / Refine; balance ticks down by the op cost
   (1 text, 2 voice/photo). At 0 → "out of credits" prompt.
5. **Manage / cancel** — Settings → Manage billing → Stripe portal → cancel.
   Webhook flips status; tier returns to free at period end.
6. **Idempotency** — `stripe events resend <evt_id>` for a processed event →
   no double credit/charge (receipt + ledger keys dedupe).
