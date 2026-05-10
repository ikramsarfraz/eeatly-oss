# Beta launch runbook

Short operational guide for the first CookLoop beta cohort. Prefer stability and learning over feature churn.

## Who to invite first

- **Internal / design partners** — People who will file precise bug reports and tolerate rough edges.
- **Small wave** — A handful of real cooks who match the “nightly meal loop” persona before widening the funnel.
- Tag cohorts in **`/admin/users`** (`alpha`, `beta_wave_1`, etc.) so analytics stay attributable.

## First 24 hours — what to watch

- **Auth** — Magic links delivered and consumed; no spike in failed sign-ins (support DMs).
- **`/admin/emails`** — Outbound mail and webhook rows look sane (no mass bounces).
- **`/admin/analytics`** — Funnel events firing (`signed_up`, `completed_onboarding`, `first_meal_logged`, `meal_logged`).
- **Errors** — Vercel logs / your host’s error stream for 5xx on `/api/*`.
- **Feedback** — New items in **`/admin/feedback`**; triage within a day so people feel heard.

## Metrics that matter (early)

- **Activation** — Onboarding completion → first meal → second meal (not vanity traffic).
- **Retention helpers** — Day-1 / day-7 return signals already surfaced in admin analytics; watch **at-risk** and **inactive** slices on **`/admin/users`**.
- **Email health** — `email_bounced`, `email_complained`, `email_delivery_failed` — pause outreach if complaints spike.
- **Qualitative** — Recurring confusion beats one-off feature whims.

## When to pause invites

- Auth or database instability (5xx, broken sessions).
- **Sustained** bounce or complaint rate on email (deliverability harmed).
- A **blocking** bug in logging or sign-in with no workaround.
- You cannot keep up with feedback triage—fix the bottleneck before adding volume.

## How to triage feedback

1. **Bugs / confusion blocking the core loop** — Reproduce, file, fix first.
2. **Small copy or UX fixes** that unblock activation — Quick wins.
3. **Feature requests** — Log and defer unless they remove a clear funnel drop (see README “prioritizing retention vs features”).
4. Reply briefly to beta users when you fix their issue—it closes the feedback loop.

## What not to change during week one

- **Schema** without a migration plan and deploy window.
- **Auth secrets** (`BETTER_AUTH_SECRET`) casually—invalidates every session.
- **Large feature additions** — Bias to retention fixes and clarity.
- **Billing, AI, groceries, nutrition, social, campaign automation** — Out of scope for this beta phase.

## Related docs

- [`production-smoke-test.md`](./production-smoke-test.md) — Deploy and smoke steps.
- Root **README** — Full stack, env vars, Resend webhooks, and admin promotion SQL.
