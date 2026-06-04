# Changelog

All notable changes to eeatly are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-06-04

First production release: the public v1 launch. eeatly is a shared kitchen for
families who cook from far apart, save the recipes everyone actually cooks,
capture them with AI, log every cook, and share across one household.

### Platform & architecture
- Restructured into a pnpm-workspaces monorepo: `apps/web` (Next.js 16, App
  Router), `apps/mobile` (Expo + React Native, Phase-1 magic-link auth), and
  shared `packages/api` + `packages/shared`.
- Migrated every client-driven interaction to tRPC v11 (removed the legacy
  `actions/` layer); structured `TRPCError` causes with wire-stable `reason`
  strings the client UI keys off.
- Stack: React 19, TypeScript 5, Tailwind CSS 4, Drizzle ORM + Neon Postgres,
  Better Auth, TanStack Query v5, Resend + React Email.

### Recipes & cooking
- Structured recipes: per-row ingredients (`meal_ingredients`) and steps
  (`recipe_steps`) alongside the legacy text fields, with a graceful fallback
  parser for older meals.
- "Refine recipe" AI editor: chat-style, per-device draft sessions with
  proposed-change diffs, heads-up rules, and atomic save.
- Source URLs: paste a recipe link and the recipe view embeds it (YouTube /
  TikTok / Pinterest native embeds; Instagram / arbitrary URLs as server-side
  OG preview cards, guarded by an SSRF scheme/IP allowlist).

### Sharing
- Per-item "Yours / Shared with you" sharing model with a People circle,
  connection invitations, library + plan share surfaces, and privacy controls.

### AI & credits
- AI capture from photo, text, and voice; ingredient extraction; recipe share
  generation.
- Credit metering engine: monthly grant per tier plus rolling top-up packs,
  atomic deduct-and-refund, full ledger.
- Dish-image generation with Gemini 2.5 Flash Image primary and gpt-image-1
  fallback.

### Pricing & monetization
- Four tiers: Cook (free), Chef, Head Chef, Master Chef, with a fixed
  discounted annual rate and a 14-day no-card Master Chef trial.
- Stripe is the source of truth for the sellable catalog (metadata-tagged
  prices + credit packs), fetched live and cached; display falls back to
  hardcoded amounts before Stripe is wired.
- Launch promo (`LAUNCH_FREE_ACCESS`): every plan unlocked free, no card, with
  the monthly credit grant floored at the launch level so the number shown
  matches what users receive. Checkout is blocked while the promo is on. All of
  it auto-reverts once Stripe is configured.

### Admin platform
- Platform admin served on the `admin.<root>` subdomain (role-gated, with an
  optional host check), with a sidebar shell.
- AI usage / cost-vs-revenue dashboard with token-accurate COGS, model mix, and
  all-users spend; feature-gate management; feedback reply-by-email; live Stripe
  catalog viewer with a one-click sync.

### Email
- Per-category From / Reply-To senders, a unified branded layout, and a
  brand-correct wordmark; branded magic-link sign-in email.

### Auth
- Magic links (always on) plus optional Google OAuth, 90-day rolling sessions,
  and cross-subdomain session cookies for the admin host.

### Marketing & copy
- Rebuilt landing page, plus `/pricing`, `/privacy`, and `/help`.
- Launch-access messaging on the landing hero and pricing page.
- Em dashes removed from all user-facing copy (now a documented house rule).

### Mobile (Phase 1)
- Expo dev-client app with magic-link auth and a Recipe Detail screen that
  prefers structured recipe rows and falls back to a client-side parser; shared
  design tokens, dark mode, and brand fonts.

### Infrastructure
- Build-time Drizzle migrations on deploy, UAT-aware Sentry, optional Redis
  rate-limiting, and R2 photo uploads served from `cdn.eeatly.com` with
  immutable caching.

[1.0.0]: https://github.com/ikramsarfraz/eeatly/releases/tag/v1.0.0
