# Changelog

All notable changes to eeatly are documented here. This project adheres to
[Semantic Versioning](https://semver.org/).

## [1.4.0] - 2026-06-11

Minor: joining a kitchen never collides with your recipes anymore, cook
history is now private to each member, and the recipe page can switch
between your copy and copies shared with you. Two migrations ship with this
release (0044, 0045); run `pnpm db:migrate` before deploying.

### Improvements
- Joining a kitchen is no longer blocked when you and the kitchen both have
  a dish with the same name. You keep full ownership of everything you
  bring; both copies coexist, each visible only to its owner.
- The recipe page now shows switch pills when you can see more than one
  recipe for the same dish (your copy plus copies shared with you), one
  click apart on web and mobile web.
- Logging a meal now always lands on your own recipe first, then a recipe
  shared with you, and otherwise creates your own copy. Logging can no
  longer attach your cooks (or your recipe edits) to another member's
  private recipe just because the names match.

### Privacy
- Cook history is personal now. Dashboards, History, and the recipe page
  count and list only your own cooks. Sharing a recipe or a kitchen no
  longer reveals when or how often someone else cooked, nor their log notes
  and photos.
- Deleting a cook log is now restricted to the member who logged it.
- A recipe shared with view-only access can no longer have its content
  overwritten by the viewer's log.

### Fixes
- Kitchen invitation and connection emails now send reliably. They were
  fired without awaiting on serverless, so sends could be cut off mid-flight
  and fail with a network error.
- The invitation accept page no longer stacks the same error twice, and the
  Accept button stays disabled when the preview already found a blocker.

### Database
- `0044_recipe_variants.sql`: adds the `recipe_variants` table and
  `variant_id` columns on `meal_ingredients` / `recipe_steps` (currently
  dormant; reserved for a future explicit merge tool).
- `0045_meals_per_creator_unique.sql`: meal uniqueness moves from
  household-wide to per creator within a household.

[1.4.0]: https://github.com/ikramsarfraz/eeatly/releases/tag/v1.4.0

## [1.3.4] - 2026-06-09

Patch: restores the "Switch to admin" link host on the www origin. No schema
changes or migrations.

### Fixes
- The "Switch to admin" shortcut now points at admin.eeatly.com again. After
  the app origin moved to www, it had been building an unreachable
  admin.www.eeatly.com host.

[1.3.4]: https://github.com/ikramsarfraz/eeatly/releases/tag/v1.3.4

## [1.3.3] - 2026-06-09

Patch: a sharper search-result favicon and canonical URLs aligned on the www
host. No schema changes or migrations.

### Improvements
- Favicon: the browser-tab and search-result icon is now a crisp vector mark
  that stays legible at small sizes, replacing the blurry raster version.
- SEO: the homepage canonical, sitemap, robots, and social-share image URLs
  now point straight at the www host, so crawlers and link previews no longer
  take an extra redirect hop.

[1.3.3]: https://github.com/ikramsarfraz/eeatly/releases/tag/v1.3.3

## [1.3.2] - 2026-06-08

Patch: mobile recipe-detail photo actions and more legible dates on recipe
cards. No schema changes or migrations.

### Improvements
- Mobile: the recipe detail now lets editors change the dish photo (a camera
  button on the image) or generate an AI image when there is none yet, matching
  the desktop view.
- Recipe cards on Home and Library show the cooked-on weekday and date more
  prominently (larger and darker), so the day reads at a glance.

[1.3.2]: https://github.com/ikramsarfraz/eeatly/releases/tag/v1.3.2

## [1.3.1] - 2026-06-07

Patch: fixes for mobile add and edit, recipe saving, plan credit display, and
clearer dates on recipe cards. No schema changes or migrations.

### Fixes
- Mobile: the Save button on "Add a meal" and "Edit recipe" was hidden behind
  the bottom navigation, so there was no way to save. The bottom bar now steps
  aside on those screens, and the Save bar clears the home indicator.
- Editing a recipe no longer fails with "Step title is too long" on ordinary
  step instructions. Step text is saved as the instruction body (which allows
  much longer text), and a failed save now shows a readable message instead of
  raw validation details.
- Pricing: each plan now shows its real monthly AI credits (the Cook plan reads
  40, not 300). The launch promo is unchanged: everyone still receives the
  larger launch grant while it is on.

### Improvements
- Recipe cards on Home and Library now lead with the weekday and date (for
  example "Tue, Jun 3"), so you can see at a glance when a dish was last cooked.
  Mobile cards that previously showed no date now include it.

[1.3.1]: https://github.com/ikramsarfraz/eeatly/releases/tag/v1.3.1

## [1.3.0] - 2026-06-07

Email and password sign-in with full account recovery, a redesigned web Library
and Add/Edit flows, a rebuilt mobile app, and per-recipe archive and delete.
Includes database migrations, which run automatically on deploy.

### Accounts and sign-in
- Sign in with an email and password as an alternative to the magic link. Magic
  links stay on, and new accounts can use either from sign-up.
- Forgot your password? Request a reset link from the sign-in page, then set a
  new one. Links are one-time and expire after an hour, and the request always
  shows the same confirmation so it never reveals whether an account exists.
- Change your password from the Account settings. If you have only ever used a
  magic link or Google, you can set a password there too (we email you a link).

### Library
- Archive or delete any recipe, with one-tap Undo. Archived recipes move to a
  dedicated Archived view, and a delete can be reversed right afterward.
- Switch between grid and list, sort your recipes, and load more.
- Automatic AI tags on your recipes, plus faceted filters to slice the library.
- Archive and Delete are also available directly on the recipe page.

### Add and edit (web)
- Rebuilt "Assist" flows for adding a meal and editing a recipe, with voice
  capture and inline AI refine in the same screen.

### Mobile
- Rebuilt app: refreshed Library and Settings, and a unified bottom tab bar with
  a center "Log a meal" action.
- Recipe photos now render across mobile surfaces, not just the letter tile,
  with a read-after-write retry so a fresh photo never shows as broken.
- Back buttons and a consistent app bar across screens. Send feedback, Help and
  guides, and onboarding now live in the account menu.
- Share a recipe from the mobile recipe screen.
- Mobile-web redesign of the shell and screens, including Notifications and
  Search.

### Recipes
- Set a per-recipe effort level that overrides the value derived from your cook
  logs.

### Under the hood
- Database migrations run on deploy: recipe effort override, archive and delete
  columns, and recipe tags.

[1.3.0]: https://github.com/ikramsarfraz/eeatly/releases/tag/v1.3.0

## [1.2.0] - 2026-06-06

Social-share previews and app branding, plus reliability fixes. Shared links now
render a rich preview card, the app ships its real favicon, icons, and PWA
manifest, and AI meal suggestions no longer time out on longer recipes. No
schema changes or migrations.

### Sharing & social previews
- Links shared from eeatly (a recipe, a meal plan, or the home page) now render
  a branded 1200x630 preview card in WhatsApp, iMessage, and X instead of a
  blank or text-only box. Recipe and plan cards show the dish's color tile,
  monogram, and title; the default card carries the wordmark and tagline. Cards
  are generated server-side.
- Public share pages stay out of search results (per-page noindex) while
  remaining fetchable by social-preview crawlers, so the cards render without
  the shared recipes getting indexed.

### Branding & install
- Added the brand favicon, app icon, and apple-touch-icon, plus a PWA web
  manifest (install name, 192/512 icons, standalone display, brand theme
  color), replacing the framework defaults. The browser tab now shows the
  cream-on-forest mark.

### SEO
- Set `metadataBase`, an absolute `og:url`, and a raster Organization logo for
  structured data, and reconciled `robots.txt` and the sitemap to the live
  routes. Removed the old SVG share image that social scrapers never rendered.

### Fixes
- Voice, text, and photo AI suggestions no longer fail on longer recipes. The
  suggestion step had been running on a short timeout sized for small calls
  while it generates a full recipe; it now gets a generation-appropriate budget,
  matching the Refine flow. When generation does fail, the voice error no longer
  wrongly blames the audio.
- Neon's idle serverless connection drops ("Connection terminated unexpectedly")
  no longer surface as uncaught exceptions. Internal hygiene, no user impact.

### Internal
- The share-card image route reads through a lean database-only path, so it no
  longer depends on the AI provider keys.

[1.2.0]: https://github.com/ikramsarfraz/eeatly/releases/tag/v1.2.0

## [1.1.1] - 2026-06-05

Front-door polish. No new features, schema, or migrations.

### Marketing, public & auth pages
- The landing, public (privacy / help / pricing), and auth (sign-in / sign-up)
  pages are now always presented in light mode, even for a signed-in user who
  chose Dark in Settings. Driven by `forcedTheme` on the single root theme
  provider (matched by route), so it never touches the saved preference and the
  dashboard still honors Dark. Removed the now-redundant dark toggle from the
  marketing header.
- Mobile: the marketing header is responsive now. On phones it drops the middle
  nav (Features / Pricing / Help, still in the footer) and keeps the Sign in /
  Try eeatly actions, with tighter section gutters and a trimmed hero heading.
  Verified the landing, sign-in, sign-up, help, privacy, and pricing render
  light with no horizontal overflow at phone width.

### Copy
- Removed a stray em dash from the auth form caption (house rule).

### Docs
- Added `docs/product-overview.md`, a portable product brief (positioning,
  feature catalog, tiers/credits, launch status) for marketing strategy work.

[1.1.1]: https://github.com/ikramsarfraz/eeatly/releases/tag/v1.1.1

## [1.1.0] - 2026-06-05

First post-launch feature release. Closes the AI capture/edit loop, adds
in-app onboarding, hardens SEO, and fixes mobile-web layout issues.

### Recipes & cooking
- AI capture now generates a full best-effort recipe (ordered ingredients +
  numbered steps) from a bare dish name, finished-dish photo, or voice note
  that only names a dish, and flags it as an "AI draft, verify" so inferred
  content is clearly distinguished from extracted content.
- Logging a meal auto-splits the captured recipe into structured ingredients
  and steps, and opens the recipe detail page on creation.
- New credit-free manual recipe editor: add, edit, reorder, and delete
  ingredients and steps without spending AI credits, writing the same
  structured tables the Refine flow uses.

### Onboarding & help
- In-app Tour & Help: a first-run welcome modal, a coached spotlight tour
  (desktop), and a searchable Help slide-over with per-feature guides.
  Contextual "?" tips sit on page titles. The tour gracefully offers guides
  instead of the spotlight on mobile.

### Pricing & trials
- Master Chef trial shortened to 7 days.
- Admin "grant complimentary access" tool: give a user paid-tier access for a
  chosen number of days (with an email), independent of Stripe.
- Re-balanced AI credit costs onto a 1·2·3·5·10 ladder; "How credits work"
  rows now sort cheapest-first.

### SEO
- `robots.txt`, sitemap, per-route `noindex` for private pages, an
  `X-Robots-Tag` header for non-public paths, and JSON-LD structured data.

### Appearance
- App now defaults to light mode (no OS theme tracking).

### Admin
- Sticky admin top bar with breadcrumbs and a wider, tighter content area.

### Mobile web fixes
- Bottom tab bar is fixed to the viewport with route-matched icons and labels
  (Home / Library / Plans); Ideas is parked for a rebuild (#61).
- Share modal no longer overflows the screen on narrow viewports.

### Fixes & copy
- Help panel accessibility: the Sheet now has a proper title for screen
  readers.
- Removed remaining em dashes from user-facing copy per the house rule.

### Database
- Migrations `0039_user_complimentary_access` and `0040_recipe_ai_draft`
  (applied at build time on deploy).

[1.1.0]: https://github.com/ikramsarfraz/eeatly/releases/tag/v1.1.0

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
