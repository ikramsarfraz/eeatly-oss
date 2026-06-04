# Web vs Mobile Parity Audit

_Date: 2026-05-17_
_Author: Claude (read-only audit)_
_Reference baseline: R20 (mobile, PR #43), develop @ `31d0e1f` (R20 follow-up fix)_

This document inventories every dimension along which `apps/web/` and
`apps/mobile/` diverge as of late R20. It is intentionally exhaustive —
edge cases and one-line follow-ups are listed alongside major gaps, so
subsequent consolidation rounds can be scoped with full visibility. No
implementation work is recommended; that's the user's call.

The R20 work prompt asked for a "list of what web is behind on" — this
document supersedes any informal punch list. Where the four-agent
research pass conflicted, the findings were re-verified by hand against
the working tree and the corrected version is reported here. Significant
corrections from the informal punch list are flagged inline.

---

## Executive summary

- **Total dimensions audited:** 11
- **Web behind mobile:** 18 items (mostly visual / design-system / Refine UI)
- **Mobile behind web:** 4 items (onboarding flow, public-share viewing, some plan ops, web-only admin/billing surfaces)
- **Intentional divergence (no gap):** 14 items (push, biometrics, marketing, admin, cron, webhooks, voice-recording strategy, etc.)
- **Standing follow-ups carried from prior rounds:** 11 items

**Top 3 highest-impact gaps**, all "web behind mobile":

1. **Refine + Review UI on web** — R18 procedures shipped 18 months of backend, mobile UI shipped in R20, web frontend completely absent. The single biggest user-facing gap.
2. **Recipe Detail ignores R18 structured data** — `meals.getById` returns `structuredIngredients` + `structuredSteps`, mobile prefers them with legacy fallback, web's page reads only `meals.ingredients[]` + `meals.recipeText`. Saved Refine sessions therefore never surface on web.
3. **No dark mode on web** — mobile shipped a full dark palette in R19/R19.5/R19.7 with `dark:` Tailwind variants and `useThemeColors()` runtime hook. Web has only light-mode CSS variables in `globals.css` and zero `dark:` consumers.

The other 15 web-behind items are smaller — primitives missing on web (`MealTile`, `PageTitle`, `Chip` tones, `Toast`, `Screen` scaffolds), editorial typography, structured-step rendering, etc. Several are 1-2 file ports; collectively they account for the visual cliff between the two apps.

---

## Detailed findings

### 1. Feature surfaces

Verified by reading routes, grepping for procedure consumers, and confirming UI exists vs is stubbed.

| Feature | Web state | Mobile state | Classification |
| --- | --- | --- | --- |
| **Auth — magic link** | `app/(auth)/sign-in/`, magic-link callback handled by Better Auth | `app/(auth)/sign-in.tsx` + `app/verify.tsx` (deep-link `eeatly://verify`) | parity |
| **Auth — Google OAuth** | `auth/google-auth-button.tsx`, gated on env vars | Not implemented (magic link only) | intentional-divergence |
| **Auth — sign-out** | `signOutAndRedirect` mutation via `account/` components | Local secure-store clear + redirect | parity |
| **Auth — account delete** | `account/delete-account-card.tsx` → `auth.deleteAccount` | Not implemented | web-only (mobile-behind, low) |
| **Onboarding — kitchen creation + habits** | `app/onboarding/page.tsx` + `OnboardingFlow` component + `onboarding.saveHabits` / `.complete` | **Not implemented.** Mobile users must complete onboarding on web. Mobile renders nothing for `users.onboardingCompletedAt` checks. | mobile-behind |
| **Manual meal logging** | `components/forms/meal-log-form.tsx` (full form, embedded in dashboard + quick-log dialog) | `components/meal-log-form.tsx` + `app/(authed)/add/log.tsx` | parity |
| **AI capture from text** | `components/forms/ai-suggest-dialog.tsx` → `ai.suggestFromText` | `app/(authed)/add/ai-suggest.tsx` → same | parity |
| **AI capture from photo** | Same dialog, `ai.suggestFromPhoto`, base64 inline | Same flow, `expo-image-picker` → base64 | parity |
| **AI capture from voice** | **Yes — browser MediaRecorder** in `ai-suggest-dialog.tsx` (lines 80–139); falls back to file upload when `window.MediaRecorder` missing | `expo-audio` recorder | parity (different recording APIs, same backend) |
| **Recipe view (`/meal/[id]`)** | `app/(dashboard)/meal/[id]/page.tsx` renders meal, but **only legacy `meals.ingredients[]` + `meals.recipeText` blob**. Does NOT read `structuredIngredients` / `structuredSteps`. | `app/(authed)/meal/[id]/index.tsx` prefers structured rows when present, falls back to legacy parsing via `parseSteps` + `parseIngredientLine`. | web-behind (partial parity) |
| **Ingredient checklist with have/need toggle** | `components/meals/ingredient-checklist.tsx` (session-local `useState`) | Inline `IngredientsSection` in meal detail (session-local) | parity (both intentionally non-persistent) |
| **WhatsApp shopping list export** | `whatsappHref()` → `wa.me` link in ingredient-checklist + share dialog | Same `wa.me` URL via `Linking.openURL` | parity |
| **Plans — list** | `app/(dashboard)/plans/page.tsx` | `app/(authed)/plans/index.tsx` | parity |
| **Plans — create** | `app/(dashboard)/plans/new/page.tsx`, `plan-form.tsx`. Gated on Plus via service `plans_create` feature gate. | `app/(authed)/plans/new.tsx` — full form. Same `UPGRADE_REQUIRED` modal path. **Correction**: a prior informal note said mobile lacked create; mobile has it. | parity (paywall same on both) |
| **Plans — detail / edit / reorder** | `plans/[id]/page.tsx` + inline edits, `update`, `addDish`, `removeDish`, `reorderDishes`, `archive`, `unarchive` | `plans/[id]/index.tsx` + `plans/[id]/edit.tsx`. **Mobile lacks**: `reorderDishes`, `archive`, `unarchive` consumers. Also has a `// TODO: wire to plans.delete once available` comment (no such procedure exists). | web-behind on reorder/archive (small); mobile-behind on plan-deletion expectation (no procedure to wire) |
| **Plans — clone past plan** | `clone-plan-dialog.tsx` | `clone-plan-sheet.tsx` (R19.7 theme-aware) | parity |
| **Plans — annotations editor** | `annotation-editor.tsx` (inline expand/collapse on plan detail) | `plan-annotation-sheet.tsx` (modal sheet, debounced auto-save) | parity (different UX patterns; same `plans.updateDishAnnotation`) |
| **Plans — previous annotations hint** | Not surfaced in current UI; service exposes it; web's clone-plan dialog could enrich but doesn't | Mobile clone-sheet calls `plans.previousAnnotationsByMeal` to render hint pills | web-behind (low) |
| **Sharing — public share link generation** | `share-link-dialog.tsx` → `shares.create` / `.revoke` / `.activeForMeal` | `share-sheet.tsx` → same procedures | parity |
| **Sharing — public viewer (`/share/[token]`)** | `app/share/[token]/page.tsx` (unauthenticated; JSON-LD; SEO) | None — mobile doesn't render the public viewer (would be redundant; app users are authed) | intentional-divergence |
| **Households — list members** | `account/household-card.tsx` | `app/(authed)/settings.tsx` (calls `households.current`) | parity |
| **Households — invite** | Owner-only invite from `household-card.tsx` | `app/(authed)/household/invite.tsx` | parity |
| **Households — accept invite (with dry-run preview)** | `app/invite/[token]/page.tsx` + `accept-invitation-card.tsx` | `app/invite/[token].tsx` (R19.7 migrated off compat aliases) | parity |
| **Households — remove member** | `household-card.tsx` → `households.removeMember` | Not implemented | mobile-behind (low) |
| **Households — leave** | Inline action on household card | `households.leaveHousehold` from settings | parity |
| **Library / meal search** | `app/(dashboard)/history/page.tsx` + `search.meals` debounced server call | `app/(authed)/library/index.tsx` (filters in-memory off `dashboard.meals`; can use `search.meals` for typeahead inside add-dish) | parity (different fetch strategies, same UX) |
| **Settings — account + sign-out** | `app/(dashboard)/settings/page.tsx` | `app/(authed)/settings.tsx` | parity |
| **Settings — billing / subscription** | `subscription-card.tsx` + Stripe portal link via `billing.createPortalSession` + checkout via `billing.createCheckoutSession` | Reads `billing.currentSubscription`; "Upgrade" CTA opens web pricing via `Linking.openURL` | intentional-divergence (mobile delegates checkout to web; in-app purchase parity is parking-lot) |
| **Video URL references + embeds** | `components/embeds/{youtube,tiktok,pinterest,url-preview-card}.tsx`; uses iframes | Same names; uses `react-native-webview` for video, native View for OG card | parity |
| **Refine recipe — text/voice/photo composer** | **Not implemented.** Backend procedures exist in `server/trpc/routers/refine.ts`; no client UI. | `app/(authed)/meal/[id]/refine/index.tsx` (R20) | web-behind (highest impact) |
| **Refine recipe — review screen (diff + heads-up)** | **Not implemented.** | `app/(authed)/meal/[id]/refine/review.tsx` (R20) | web-behind |
| **Stripe paid tier / Plus features** | Web-side billing dashboard + checkout + portal; Stripe webhook handler at `app/api/webhooks/stripe/route.ts` | Reads subscription state; deep-links to web for upgrade | intentional-divergence |
| **Marketing landing page** | `app/page.tsx` (large editorial component) | n/a | intentional-divergence |
| **Privacy / Help / Terms** | `app/(public)/{privacy,help}/page.tsx` | n/a (mobile would need links to web) | intentional-divergence |
| **Admin dashboard** | `app/admin/{users,analytics,feedback,emails,features}/` | n/a | intentional-divergence |
| **Notifications bell** | `components/layout/notification-bell.tsx` consumes `notifications.list`, `markRead`, `markAllRead` | Not implemented — mobile has no inbox UI | mobile-behind (medium) |
| **Feedback widget** | `feedback/feedback-dialog.tsx` → `feedback.submit` | `app/(authed)/(tabs)/home.tsx` (3 callsites — embedded entry points) | parity |

#### Feature summary

- Refine + Review (2 surfaces) are the only **major** web-behind features.
- Onboarding, in-app notifications, member-removal, plan-archive, and a few small surfaces are **mobile-behind**.
- Marketing, public-share viewer, admin, billing checkout, OAuth, and webhooks are **intentional divergence** (web-only by architecture).

---

### 2. Backend procedure consumption

Every tRPC procedure registered on `AppRouter`, with current consumer per platform. Mined from `apps/web/server/trpc/routers/*.ts` and `grep -r "trpc\.<router>\." in apps/web + apps/mobile`.

#### Both consume

| Procedure | Web call site | Mobile call site |
| --- | --- | --- |
| `ai.suggestFromText` | `forms/ai-suggest-dialog.tsx` | `add/ai-suggest.tsx` |
| `ai.suggestFromPhoto` | same | same |
| `ai.suggestFromVoice` | same | same |
| `ai.extractIngredientsForMeal` | `meals/ingredient-checklist.tsx` | meal detail (button to refresh ingredient list) |
| `dashboard.meals` | `hooks/use-dashboard-meals.ts` | `(authed)/home.tsx` |
| `feedback.submit` | `feedback/feedback-dialog.tsx` | `(authed)/home.tsx` |
| `households.invite` | `account/household-card.tsx` | mobile household screens |
| `households.acceptInvitation` | `account/accept-invitation-card.tsx` | `invite/[token].tsx` |
| `households.revokeInvitation` | `account/household-card.tsx` | mobile household screens |
| `meals.createLog` | `use-dashboard-meals.ts` | `components/meal-log-form.tsx` |
| `plans.list` | `plans/plan-detail.tsx` | `plans/index.tsx` |
| `plans.create` | `plans/plan-form.tsx` | `plans/new.tsx` |
| `plans.update` | `plans/plan-detail.tsx` | `plans/[id]/edit.tsx` |
| `plans.addDish` | `plans/add-dish-picker.tsx` | `plans/[id]/index.tsx` (add-dish path) |
| `plans.removeDish` | `plans/plan-detail.tsx` | mobile plan detail |
| `plans.cloneFromPast` | `plans/clone-plan-dialog.tsx` | `clone-plan-sheet.tsx` |
| `plans.updateDishAnnotation` | `plans/annotation-editor.tsx` | `plan-annotation-sheet.tsx` |
| `search.meals` | `plans/add-dish-picker.tsx` | `plans/[id]/add-dish` |
| `shares.create` | `shares/share-link-dialog.tsx` | `share-sheet.tsx` |
| `shares.revoke` | same | same |
| `urlPreview.fetch` | `embeds/url-preview-card.tsx` | `embeds/url-preview-card.tsx` |

#### Web-only consumers

| Procedure | Web call site | Mobile state | Notes |
| --- | --- | --- | --- |
| `admin.*` (9 procedures: featureRegistry, featuresWithCounts, overridesForFeature, userSearch, createGateOverride, deleteGateOverride, updateBetaCohort, dispatchLifecycleEmail, trackReminderPlaceholder) | `components/admin/*` | n/a | intentional |
| `analytics.trackAuthFunnel` | `forms/auth-email-form.tsx` | n/a | intentional (mobile auth is web-callback bound) |
| `analytics.trackUserEvent` | `onboarding/flow.tsx` | n/a | intentional |
| `auth.deleteAccount` | `account/delete-account-card.tsx` | n/a | mobile-behind (low) |
| `auth.signOutAndRedirect` | `account/invite-email-mismatch.tsx` | n/a | parity-ish (mobile clears secure-store directly) |
| `billing.createCheckoutSession` | `pricing/pricing-card.tsx` | n/a | intentional (Stripe via web only) |
| `billing.createPortalSession` | `account/subscription-card.tsx` | n/a | intentional |
| `households.removeMember` | `account/household-card.tsx` | n/a | mobile-behind (low) |
| `notifications.list` / `.markRead` / `.markAllRead` | `layout/notification-bell.tsx` | n/a | mobile-behind (medium) |
| `onboarding.saveHabits` / `.complete` / `.updatePreferences` | `onboarding/onboarding-flow.tsx`, `account/preferences-card.tsx` | n/a | mobile-behind (high — see §1) |
| `plans.archive` / `.unarchive` / `.reorderDishes` | `plans/plan-detail.tsx` | n/a | mobile-behind (low/medium) |
| `shares.activeForMeal` | `dashboard/share-recipe-dialog.tsx` | n/a | mobile-behind (low — `listForMeal` works instead) |
| `shares.getByToken` | `share/[token]/page.tsx` (public viewer) | n/a | intentional |
| `ai.generateShareableRecipe` | `dashboard/share-recipe-dialog.tsx` | n/a | mobile-behind (low) |

#### Mobile-only consumers

| Procedure | Mobile call site | Web state | Notes |
| --- | --- | --- | --- |
| `refine.startSession` | `meal/[id]/refine/index.tsx` | n/a | web-behind (highest) |
| `refine.getPendingChanges` | `refine/index.tsx`, `refine/review.tsx` | n/a | web-behind |
| `refine.submitTextTurn` | refine/index.tsx | n/a | web-behind |
| `refine.submitVoiceTurn` | refine/index.tsx | n/a | web-behind |
| `refine.submitPhotoTurn` | refine/index.tsx | n/a | web-behind |
| `refine.toggleTurnAccepted` | refine/index.tsx | n/a | web-behind |
| `refine.save` | refine/review.tsx | n/a | web-behind |
| `refine.discard` | refine/index.tsx | n/a | web-behind |
| `meals.getById` | mobile meal detail | Web's page reads via direct service call (`getMealDetail`) at SSR time — not via tRPC | divergence (web SSR vs mobile client query) |
| `households.current` | `(authed)/settings.tsx` | Web reads via auth session helper server-side | divergence |
| `households.pendingInvitations` | mobile settings | n/a | mobile-behind (low) on web inbox UI |
| `households.invitationByToken` | `invite/[token].tsx` | Web reads inline via service | divergence |
| `households.leaveHousehold` | mobile settings | n/a (web does it via different flow) | acceptable divergence |
| `plans.getById` | mobile plan detail | Web reads via service | divergence |
| `plans.mealLibrary` | mobile add-dish | Web uses `search.meals` instead | acceptable divergence |
| `plans.effortAggregate` | mobile plan detail | n/a | web-behind (low) |
| `plans.previousAnnotationsByMeal` | `plan-annotation-sheet.tsx` (also clone-plan-sheet) | Not surfaced in UI | web-behind (low) |
| `billing.currentSubscription` | mobile settings | Web reads server-side | acceptable divergence |
| `shares.listForMeal` | `share-sheet.tsx` | Web uses `activeForMeal` instead | acceptable divergence |

#### Zombie procedures (defined but never called)

- `auth.signOut` — superseded by `signOutAndRedirect`
- `health.ping` — smoke-test endpoint
- `meals.historyRows` — defined but unused; history list rebuilt via `dashboard.meals`
- `meals.historyStats` — same
- `shares.listForHousehold` — superseded by `listForMeal`

5 zombie procedures total. Worth a deferred cleanup pass (low priority — no harm beyond dead code).

---

### 3. Schema usage

Tables added since R11. Writes/reads tracked through services + procedures + UI.

| Table | Writes | Reads (procedure) | Web UI reads | Mobile UI reads |
| --- | --- | --- | --- | --- |
| `meal_ingredients` (R18) | `services/refine.ts:saveSession` (only writer) | `meals.getById` includes `structuredIngredients[]` | **No.** `meal/[id]/page.tsx` ignores the field, reads legacy `meals.ingredients[]` text array. | Yes — prefers structured, falls back to legacy. |
| `recipe_steps` (R18) | `services/refine.ts:saveSession` | `meals.getById` includes `structuredSteps[]` | **No.** Reads `meals.recipeText` blob into `<pre>`. | Yes — prefers structured `StepCard` rendering, falls back to text parsing. |
| `refine_sessions` (R18) | `refine.startSession`, `submit*Turn` update `lastActiveAt`, `save`/`discard` close | `refine.getPendingChanges`, `refine.startSession` | n/a | Yes |
| `refine_turns` (R18) | All `submit*Turn` procedures | `getPendingChanges` returns turns | n/a | Yes |
| `refine_pending_changes` (R18) | All `submit*Turn`, `toggleTurnAccepted`, `save` (clears on apply) | `getPendingChanges` returns pendings | n/a | Yes |
| `url_previews` (R16) | `services/url-preview.ts` (insert-or-return-cached) | `urlPreview.fetch` reads by URL key | Yes — `url-preview-card.tsx` | Yes — same component name |
| `email_delivery_logs` (R15) | Resend webhook handler + transactional dispatch | Not via tRPC — admin reads via Drizzle | Admin dashboard only | n/a |
| `analytics_events` (R8+) | `lib/observability/analytics.ts` (server fire-and-forget) | Admin analytics dashboard via Drizzle | Yes (admin) | n/a |

**Headline finding (matches §1's web-behind on Recipe Detail):** R18 structured tables are populated **exclusively** by mobile Refine save. Web has the data shape in `getMealDetail`'s return but never renders the rows. A meal refined on mobile saves new structured ingredient/step rows, and the saved improvements **never appear when the same household views the meal on web** — the web page silently reads the legacy fields, which the Refine save path does also bump (it updates `meals.updatedAt`) but doesn't re-derive `meals.recipeText` from the structured rows.

This is a silent data-fidelity gap, not just a styling one.

---

### 4. Design system

#### Fonts

| | Web (`apps/web/app/layout.tsx`) | Mobile (`apps/mobile/lib/design/use-app-fonts.ts`) |
| --- | --- | --- |
| Sans-serif body | **Inter** (400/500/600/700) | **Geist** (400/500/600/700) — separate family per weight |
| Display serif | Instrument Serif (400 + 400 italic) | Instrument Serif (400 + 400 italic) |
| Mono | JetBrains Mono (400/500) | JetBrains Mono (400/500/600) |
| Fallback serif | Cormorant Garamond, Georgia | Georgia |

**Gap:** different sans-serif family entirely (Inter vs Geist). Mobile has one extra mono weight (600). Not a parity bug per se, but the visual rhythm differs.

#### Color tokens

**Mobile (`apps/mobile/tailwind.config.js` + `lib/design/tokens.ts`)** — 21 semantic tokens × 2 (light + dark sibling):

`cream` / `cream-soft` / `paper` / `surface` / `ink` / `ink-2` / `ink-3` / `ink-4` / `forest` / `forest-deep` / `forest-soft` / `forest-text` / `sage` / `sage-deep` / `sage-bg` / `terra` / `wheat` / `border` / `border-soft` / `danger` / `danger-soft` — each with a `-dark` variant.

R17 compat aliases (`background`, `foreground`, `primary`, `accent`, `destructive`) still defined in light-only — last real consumer is `components/photo-picker.tsx` (see §11).

**Web (`apps/web/app/globals.css`)** — CSS custom properties, light-mode only:

`--background` (`#f7f5ee`), `--foreground`, `--primary` (`#2f6f58`, matches mobile's forest), `--primary-foreground`, `--accent` (`#d77a4a` — burnt orange, **no mobile equivalent**), `--secondary` (sage-equivalent), `--muted`, `--muted-foreground`, `--destructive` (`#c44949` — different from mobile's `#A8413A`), `--card`, `--border`, `--input`, `--surface`, `--surface-2`, `--primary-soft`, `--accent-soft`, `--border-strong`, `--warn` (`#c08a2a` — **no mobile equivalent**), `--warn-soft`, plus shadcn sidebar palette (`--sidebar-*`).

**Gaps:**
- No dark variants on web (light-mode only).
- Different accent: web's burnt orange (`#d77a4a`) vs mobile's sage/wheat/terra rotation.
- Slightly different destructive red.
- Web has `--warn` / `--warn-soft` semantically unmapped on mobile.
- Web has shadcn sidebar tokens; mobile uses tab bar.

#### Dark mode

- **Mobile**: `darkMode: 'media'` in tailwind config. `useThemeColors()` + `useIsDark()` hooks for inline-style consumers. Every R19+ surface uses `dark:` variant prefix. R19.5 swept primitives; R19.7 cleaned the flagged files.
- **Web**: No `darkMode` setting. No `dark:` variant usage anywhere in `apps/web/`. No `prefers-color-scheme` media query in `globals.css`. **Web has no dark mode at all.**

This is one of the three top-impact gaps.

#### UI primitives

**Mobile (`apps/mobile/components/ui/`):** 16 components, all token-bound and dark-mode aware:

`Avatar`, `Button`, `Card` + `CardHeader/Body/Footer`, `Chip` (5 tones: sage/wheat/terra/ghost/danger), `EmptyState`, `IconBubble`, `Input`, `ListItem`, `MealTile` (4 sizes, 6-palette hashed placeholder), `PageTitle` (4 sizes, kicker + title + eyebrow + subtitle), `Screen` / `ScreenCentered` / `LoadingScreen` / `ErrorScreen`, `SectionHeader`, `SectionLabel`, `Tag`, `Toast`.

**Web (`apps/web/components/ui/`):** 19 components, mostly shadcn-flavored:

`alert-dialog`, `avatar`, `badge`, `base-tabs`, `breadcrumb`, `button`, `card`, `dialog`, `dropdown-menu`, `input`, `label`, `select`, `separator`, `sheet`, `sidebar` (shadcn collapsible, ~17 KB), `skeleton`, `table`, `textarea`, `tooltip`.

**Missing on web:**
- `MealTile` — the hashed-palette monogram placeholder. No equivalent.
- `PageTitle` — editorial kicker + display title + eyebrow + subtitle. Web has inline `<h1>` per page.
- `Chip` with the 5-tone semantic system. Web has `Badge` with default/secondary/outline/warm variants — no `sage` / `wheat` / `terra` semantics.
- `Tag` — distinct from Chip in mobile (used for status indicators).
- `IconBubble` — circular icon container.
- `Screen` / `ScreenCentered` / `LoadingScreen` / `ErrorScreen` — systematic scaffolds. Web has ad-hoc empty/loading per page.
- `Toast` (the visual auto-dismissing variant). Web has no Toast component in `ui/`.
- `SectionLabel` (mono-caps eyebrow). Web has no equivalent primitive.

**Missing on mobile (web-only because of platform):**
- `dropdown-menu`, `tooltip`, `table`, `breadcrumb`, `sidebar`, `alert-dialog`, `select` — desktop-shaped primitives. Not gaps; not needed on mobile.

---

### 5. Visual / UX patterns

| Pattern | Web state | Mobile state | Gap |
| --- | --- | --- | --- |
| **Editorial two-line title** (italic kicker + serif display, R19) | Inline `<h1 className="font-serif text-[28px]">` per page. No kicker / eyebrow / subtitle structure. | `components/ui/page-title.tsx` (used on every primary screen + new-plan + library) | web-behind |
| **MealTile hashed-palette monogram** | No equivalent. Plain `<img>` or unstyled `<div>` fallback. | `mealHash(name)` + 6-palette rotation + giant italic serif letter + dotted texture | web-behind |
| **Structured step rendering** (italic serif numeral + serif title + mono time + ingredient pills + body) | Plain `<pre className="whitespace-pre-wrap">` of `meals.recipeText`. No numerals, no titles, no time eyebrow, no ingredient pills. | `StepCard` in mobile meal detail (lines 1036–1115); reads from `structuredSteps` rows | web-behind (severe — see §3 silent data gap) |
| **Ingredient row** (checkbox + name + italic prep note + mono qty) | `ingredient-checklist.tsx` renders rows but doesn't split qty/prep visually | Mobile splits `name` / `qty` / `note` into distinct typography slots | web-behind (cosmetic) |
| **Chip tone system** (sage/wheat/terra/ghost/danger) | `Badge` variants: default/secondary/outline/warm. No `sage` / `terra`. | 5-tone `Chip` with dark variants | web-behind |
| **Toast notifications** | Web seems to use a context-based provider; no auto-dismissing visual Toast in `ui/`. | `Toast` component used by Refine + share flows | web-behind (small) |
| **Empty / loading / error states** | Per-page ad-hoc | `EmptyState` + `LoadingScreen` + `ErrorScreen` primitives | web-behind (small) |
| **Modal sheets vs dialogs** | shadcn `Sheet` (bottom drawer on mobile breakpoints) | Custom NativeWind modals (`plan-annotation-sheet`, `share-sheet`, `clone-plan-sheet`) | intentional divergence (platform-shaped) |
| **Bottom tab bar** | Responsive — only renders on `sm:` breakpoint (web app shows tabs on mobile-web) | Always-on in `(authed)/_layout.tsx` | intentional divergence |
| **Sidebar nav** | shadcn collapsible sidebar (desktop) | n/a (would be a phone anti-pattern) | intentional divergence |

---

### 6. Recently-shipped mobile features web doesn't have

Each item annotated with rough effort estimate to port (S/M/L). Estimates count files touched + design alignment needed — not engineering hours.

| Feature | Mobile reference | Effort |
| --- | --- | --- |
| **Refine recipe screen** (R20) | `meal/[id]/refine/index.tsx` + `lib/device-id.ts` + `lib/refine-format.ts` | L (new route, voice/photo capture, optimistic chat history) |
| **Review changes screen** (R20) | `meal/[id]/refine/review.tsx` | M (diff rendering + save flow; depends on Refine being there) |
| **Recipe Detail R19 redesign** | `meal/[id]/index.tsx` (lines 437–483 structured rendering, 1036–1115 StepCard) | L (editorial title + step rendering + structured data path) |
| **Dark mode tokens + variants** | `tailwind.config.js` (mobile, R19), `lib/design/{tokens,use-theme-colors}.ts` | M (token expansion + `dark:` audit across web surfaces) |
| **Structured ingredient/step rendering** | Mobile meal detail | M (largely token + JSX; reads existing service output) |
| **MealTile component** | `components/ui/meal-tile.tsx` | S (single file; pure component; web fonts already loaded) |
| **PageTitle editorial primitive** | `components/ui/page-title.tsx` | S |
| **Chip tone system** | `components/ui/chip.tsx` | S (web-side palette expansion + variants on Badge or new component) |
| **Toast component** | `components/ui/toast.tsx` | S |
| **Plan annotation modal sheet pattern** | `plan-annotation-sheet.tsx` | M (responsive `<Sheet>`; web currently has inline `annotation-editor`) |
| **Share sheet with household + WhatsApp + share-link unified** | `share-sheet.tsx` | M (web splits this across `share-link-dialog` + `share-recipe-dialog`) |
| **Photo picker (camera + library action sheet)** | `components/photo-picker.tsx` (R13) | n/a — web AI-suggest dialog already has file input + camera permission |
| **Voice recorder with waveform** | `components/voice-recorder.tsx` + Refine voice surface | n/a — web uses MediaRecorder in the AI-suggest dialog |
| **In-app notifications inbox UI** | n/a — mobile doesn't have one either | mobile-behind, not web-behind |

---

### 7. Mobile features that don't apply to web (intentional)

Confirmed intentional, not gaps:

- **In-app voice recording via `expo-audio`** — web has `MediaRecorder` fallback in `ai-suggest-dialog.tsx`. Different platform APIs, same backend.
- **Native share sheet (`Linking.openURL` + RN `Share.share`)** — web uses `<a href>` + WhatsApp link; `navigator.share()` is not currently called from web (searched — zero hits). Could be a small enhancement on web later.
- **Universal Links / App Links** — `app.config.ts` defines `eeatly://` scheme. Web uses standard URLs.
- **TestFlight + EAS internal distribution** — release channel for mobile. Web deploys via Vercel git integration.
- **Biometric auth (Face ID / fingerprint)** — neither app has it. No `expo-local-authentication` dep on mobile.
- **Push notifications** — neither app has them. No `expo-notifications` dep. The `notifications.*` procedures are for in-app inbox, not push.
- **Camera-direct flow** (`expo-image-picker.launchCameraAsync`) — web's `<input type="file" accept="image/*" capture>` is the equivalent.

---

### 8. Web features that don't apply to mobile (intentional)

- **Marketing landing page** at `app/page.tsx` — first-time-visitor surface.
- **Public pages** at `app/(public)/{privacy,help}/page.tsx` — mobile would link out to web.
- **Stripe checkout flow** at `app/pricing/page.tsx` + `billing.createCheckoutSession` — App Store / Play Store would be the mobile parity path (parking lot).
- **Stripe customer portal link** via `billing.createPortalSession`.
- **Public share viewer** at `app/share/[token]/page.tsx` — the unauthenticated recipe view. Mobile users are always authed.
- **Admin dashboard** at `app/admin/{users,analytics,feedback,emails,features}/` — internal tooling.
- **Webhook handlers** at `app/api/webhooks/{stripe,resend}/route.ts`.
- **Cron job** at `app/api/cron/lifecycle/route.ts` (daily 2 PM UTC per `vercel.json`).
- **Health check** at `app/api/health/route.ts`.
- **Sidebar navigation** (shadcn) — desktop-shaped; mobile uses tabs.
- **Google OAuth button** — mobile is magic-link only.
- **Auth funnel analytics** (`analytics.trackAuthFunnel`) — mobile auth lands in web's callback URL where the same tracking fires.

---

### 9. Tests and infrastructure

#### Test counts

- **Web**: 33 test files, **411 passing tests** (re-verified by running `pnpm test` against `develop` tip in this audit). Coverage scoped to `lib/**` + `services/**` via `vitest.config.ts`. Setup file is empty (reserved for future global mocks).
- **Mobile**: **0 test files. 0 tests.** No `jest.config.*`, no `vitest.config.*`, no test deps in `apps/mobile/package.json`. No `lint` or `test` script in mobile's package.
- **Packages** (`packages/api`, `packages/shared`): **0 tests** in either. Validators and shared helpers are tested transitively through web's test files.

Mobile testing has been deferred since R17. No partial / abandoned setup exists.

#### Test coverage gaps

- Auth flows tested on web (`lib/auth/{callback-url,email-verified,session}.test.ts`). Mobile auth is untested.
- `services/ai-refine.ts` tested on web; mobile Refine screens (which exercise that service) are untested.
- `lib/refine/heads-up-rules.ts` tested on web; mobile renders the same rule output untested.
- `lib/url-preview/ssrf.ts` tested on web (the SSRF guard); mobile consumes preview cards without test coverage.

#### Build pipeline

- **Web** — deployed via Vercel git integration. `apps/web/vercel.json` defines:
  - `buildCommand: "pnpm build"`, `installCommand: "pnpm install --frozen-lockfile"`
  - Cron: `/api/cron/lifecycle` at `0 14 * * *`
- **Mobile** — `apps/mobile/eas.json` defines 3 build channels (development / preview / production) with per-channel `EXPO_PUBLIC_API_BASE_URL` env vars. EAS Build triggered manually (no webhook into `eas build` in repo).
- **CI** — `.github/workflows/` does **not exist** at the repo root. There is no automated test/lint gate on PR; Vercel's build is the only enforcement. **Confirmed by direct directory listing.**

This is a real gap independent of web-vs-mobile: zero CI on PR for either app.

#### Lint / TypeScript parity

- **Web**: `eslint.config.mjs` extends `next/core-web-vitals` + `next/typescript`. `lint` script runs `eslint . --max-warnings=0`. tsconfig extends root `tsconfig.base.json`, strict mode on.
- **Mobile**: **No ESLint config.** No `lint` script. tsconfig extends `expo/tsconfig.base`, strict mode on (explicit).

Mobile has typechecking but no style enforcement.

---

### 10. Operational gaps

#### Email flows (all web-side)

Triggered from web procedures + cron + webhooks:

- `welcome` — sent on sign-up
- `first_meal_encouragement` — fired by lifecycle cron
- `inactive_reminder` — fired by lifecycle cron
- `weekly_recap_placeholder` — fired by lifecycle cron (placeholder logic)
- `household_invitation` — sent when an owner invites
- `household_member_removed` — sent when an owner removes someone
- `account_deleted` — sent on `auth.deleteAccount`

Resend webhook at `app/api/webhooks/resend/route.ts` ingests `email.sent` / `delivered` / `opened` / `clicked` / `bounced` / `complained` / `failed` / `delivery_delayed` / `suppressed`. Records to `email_delivery_logs` + fires analytics events.

**No mobile-specific email triggers.** Every email is triggered by a procedure call that either client can make. Mobile-initiated invites generate emails identically.

#### Webhooks (web-only)

- `/api/webhooks/stripe` — Stripe subscription state sync
- `/api/webhooks/resend` — email delivery receipts

#### Cron jobs (web-only)

- `/api/cron/lifecycle` — daily 2 PM UTC

#### Background jobs / queues

None. All work synchronous through procedures.

#### Logging / observability

- **Web** — `apps/web/lib/observability/` has 4 modules: `logger.ts` (console JSON), `analytics.ts` (fire-and-forget event tracker), `request-id.ts`, `funnel.ts`. No external service.
- **Mobile** — **No equivalent.** Mobile has no `lib/observability/`. Uses `console.log` directly.

#### Error reporting

- **Web** — No Sentry, no Bugsnag, no Datadog. Console-only error visibility.
- **Mobile** — Same. No `@sentry/react-native` or equivalent.

This is a shared blind spot — production crashes are invisible until a user reports them.

---

### 11. Open follow-ups standing

Items previously flagged in prior PRs / mid-round comments as deferred. Verified state on `develop`:

| Item | Origin | Status | Notes |
| --- | --- | --- | --- |
| **AsyncStorage for mobile ingredient checklist** | R19 | Still deferred | Session-local `useState` in `meal/[id]/index.tsx` lines 728–799. Acknowledged in component docstring. |
| **Mobile primitive snapshot tests** | R17 | Still deferred | Zero mobile tests; no test infra. |
| **R17 compat alias cleanup** | R19.7 | **Nearly complete** | Only `components/photo-picker.tsx` remains as a real consumer of `bg-background-muted` / `text-foreground-muted` / `bg-background-elevated` / `text-foreground` / `text-destructive`. `invite/[token].tsx` only has the migration doc comment. |
| **Real audio metering (Refine voice waveform)** | R20 | Deferred | Voice surface uses 24-bar `setInterval`-driven decorative animation. Real metering needs `expo-audio.getStatusAsync()` polling. |
| **`suggestedAction` interactive overrides** | R20 | Deferred | Heads-up cards in Review screen render `suggestedAction.label` as muted text; no callback wired. |
| **"Accept all" link in Diff section** | R20 | Visible but non-functional | Decorative; bulk-accept is a future round. |
| **"Or edit by hand →" link on Refine** | R20 | Visible but non-functional | Manual-edit fallback path deferred. |
| **Per-change drill-in detail** | R20 | Deferred | Diff cards on Review are static; tap-to-detail not wired. |
| **Server-side Refine session GC** | R18 | Still deferred | No background sweep of abandoned sessions; rows accumulate until manual cleanup. |
| **Multi-session conflict resolution** | R18 | Still parked | Last-write-wins. No `meal_version` snapshotting. |
| **Instagram embed** | R16 | Still deferred | Requires Meta Developer + App Review. Current behavior: server-side OG card. |
| **`plans.delete` procedure** | Standing | Not implemented | Mobile `plans/[id]/edit.tsx` line 110 has `// TODO: wire to plans.delete once available`. No corresponding procedure exists on `apps/web/server/trpc/routers/plans.ts` — `archive`/`unarchive` are the soft-delete path. |
| **Zombie procedure cleanup** | New finding (this audit) | Not addressed | `auth.signOut`, `health.ping`, `meals.historyRows`, `meals.historyStats`, `shares.listForHousehold` — 5 procedures with no consumers. |

#### Explicit `TODO` / `FIXME` comments in source

- `apps/mobile/app/(authed)/plans/[id]/edit.tsx:110` — `// TODO: wire to plans.delete once available; gracefully exits`

That's the only TODO/FIXME in source files (excluding `node_modules`, `.next/`, doc comments referencing prior PRs).

---

## Recommended consolidation phases

Suggested ordering of work to close the largest gaps. NOT a commitment — input for the user to decide round scoping.

### Phase A — small wins (each 1-2 file ports)

These close cosmetic / token gaps and seed the design system on web. None blocks the others.

- **Port `MealTile` to web** — single component, hashed palette logic already in shared shape, fonts already loaded.
- **Port `PageTitle` to web** — single editorial primitive.
- **Port `Toast` to web** — single component, replaces ad-hoc per-page toast handling.
- **Add `SectionLabel` to web** — mono-caps eyebrow, used everywhere on mobile.
- **Web `Chip` tone system** — extend `badge.tsx` variants or add new component with sage/wheat/terra/ghost/danger.
- **Add `Screen` / `LoadingScreen` / `ErrorScreen` to web** — systematize empty/loading/error states.
- **Zombie procedure cleanup** — remove `auth.signOut`, `health.ping`, `meals.historyRows`, `meals.historyStats`, `shares.listForHousehold`.
- **Migrate `photo-picker.tsx` off R17 compat aliases** — completes R19.7's mobile sweep.

### Phase B — medium (3-8 files, design alignment needed)

- **Web consumes `structuredIngredients` / `structuredSteps`** — `meal/[id]/page.tsx` rendering rewrite, replicating mobile's structured-prefer-with-legacy-fallback path. Single file but real design work (StepCard equivalent). Closes the silent data-fidelity gap from §3.
- **Web dark mode rollout** — expand `globals.css` with dark CSS variables, set `darkMode: 'class'` or `'media'` in Tailwind config (whichever Tailwind v4 supports), audit web surfaces for `dark:` variant readiness. Visual work + audit pass.
- **Mobile onboarding flow** — port the kitchen-creation + habits survey. Mobile currently has no path to create a household.
- **Mobile in-app notifications inbox** — port `notifications.list` / `markRead` / `markAllRead` consumer.
- **Web previous-annotations hint surface** — call `plans.previousAnnotationsByMeal` from the clone-plan dialog (mobile already does).
- **Mobile member-removal, plan-archive/unarchive UI** — small per-feature ports.
- **Web `navigator.share()` consumer** — wire the existing share-link flow to use native share where available.

### Phase C — large (10+ files, design system / architecture first)

- **Web Refine UI** — full `/meal/[id]/refine` route + Review screen on web. Requires: file picker for photo (already there for AI suggest, refactor), MediaRecorder (already there), device-id equivalent for web (cookie / localStorage UUID), `lib/refine-format.ts` port, full design pass. Backend is ready.
- **Web Recipe Detail R19 redesign** — editorial title + structured rendering + dark mode. Substantial work; depends on Phase A primitives + Phase B structured rendering + Phase B dark mode.
- **Web `plans.delete` procedure + UI** — closes the standing mobile TODO. Requires service + procedure + UI on both clients.

### Cross-cutting infra (any phase)

- **GitHub Actions PR gate** — typecheck + lint + test workflows for the monorepo. Currently zero CI on PR.
- **Mobile ESLint config** — bring style enforcement to mobile.
- **Mobile test infrastructure** — Jest or Vitest + React Native Testing Library. Long-deferred (R17).
- **Sentry / Bugsnag** — production error tracking for both clients. Standing blind spot.
- **R18 server-side session GC** — periodic cleanup of abandoned Refine sessions.

---

## Appendix: Verification commands

For reviewers wanting to re-verify any finding above, the audit relied on:

- `git log --oneline -10` against `develop` to confirm baseline (`31d0e1f`, R20 follow-up fix).
- `pnpm test` to confirm 411 passing tests.
- `grep -rn` for every consumer claim (file paths quoted inline).
- `find .github/workflows` (returns no such directory).
- Direct reads of `apps/web/app/(dashboard)/meal/[id]/page.tsx` (confirms legacy-only rendering), `apps/web/components/forms/ai-suggest-dialog.tsx` (confirms voice recording exists), `apps/mobile/app/(authed)/plans/new.tsx` (confirms mobile plan-create exists), `apps/mobile/components/share-sheet.tsx` (confirms mobile public-share creation exists).

Where the multi-agent research pass conflicted, the on-disk source was the tiebreaker. Several agent claims were corrected during writing (notably: web _does_ have AI capture; mobile _does_ have plan creation; public-share generation is parity, only the public-viewer is web-only).

— end of audit
