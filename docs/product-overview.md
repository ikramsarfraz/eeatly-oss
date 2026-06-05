# eeatly, Product Overview (for marketing strategy)

> A self-contained brief you can paste into a Claude chat (or share with a
> marketer / agency) to ground any positioning, copy, or campaign work. It
> describes the product as it actually ships today (v1.1.0, June 2026), not as
> roadmap. When the product changes, update this file so it stays the single
> portable reference.

---

## 1. One-liner

**eeatly is a shared kitchen for families who cook from far apart**, a place to
save the recipes everyone actually cooks, capture them with AI from whatever
form they arrive in, log every cook, and share them across one household.

Marketing meta description currently in production:
> "Save the family recipes that matter, from voice notes, WhatsApp photos,
> recipe links, however they reach you. Shared kitchens across continents."

Landing hero headline:
> **One kitchen. Your whole family. Any distance.**

## 2. Who it's for

- **Distributed families**, parents, adult kids, and relatives split across
  cities or continents who want the family's cooking in one shared place.
- **The household "keeper of recipes"**, the person who fields "how did you
  make that?" texts and wants to stop re-explaining.
- **Everyday home cooks** (not chefs or food bloggers) who want to remember what
  worked and cook it again, with less effort each time.
- Diaspora households where recipes live in a parent's head, a voice note, or a
  photo of a handwritten card.

## 3. The problem we solve

Family recipes are scattered and lossy. They arrive as voice notes, WhatsApp
photos, screenshots, recipe links, or verbal "a bit of this." They live in one
person's memory and degrade or disappear. Generic recipe apps assume you start
from a clean printed recipe and cook solo. eeatly assumes the opposite:
**recipes arrive messy, from real people, and should be shared within a family
without becoming public.**

## 4. Core value props (the three pillars)

1. **Capture from anything.** Photo, text, voice note, or a pasted link → eeatly
   turns it into a clean, structured recipe. If you only have a dish name, AI
   drafts a best-effort recipe you can verify and edit.
2. **A memory for everything you cook.** Log each cook with notes, photos, and
   effort level. Search your whole history. eeatly resurfaces meals worth
   cooking again.
3. **One shared kitchen, private by default.** Share specific recipes and plans
   with specific family members (or your whole household), with view / edit /
   admin control. Nothing is shared until you choose to.

## 5. Feature catalog (what's actually built)

### Capture & AI
- **AI capture** from **photo, text, or voice note.** Extracts the dish name,
  ingredients, and steps into a structured recipe.
- **Generate-from-name.** Bare dish name, finished-dish photo, or a voice note
  that only names a dish → AI generates a full best-effort recipe, clearly
  flagged as an **"AI-generated draft"** ("review and edit before saving") so
  inferred content is distinct from what you actually provided.
- **"Refine recipe" AI editor.** Chat-style editing: prompt the AI (text/voice/
  photo) to change a recipe; it proposes diffs, flags heads-up changes (e.g. a
  big quantity jump), and saves atomically.
- **Credit-free manual recipe editor.** Add / edit / reorder / delete
  ingredients and steps by hand, no AI credits required, so you're never stuck
  if you run out of credits.
- **Dish-image generation.** Generate an appetizing image for a dish (Gemini
  primary, GPT-image fallback).
- **Ingredient extraction** and **recipe share-card generation.**

### Recipes
- **Structured recipes**: per-row ingredients (name, quantity, prep note) and
  steps (title, time, body), with a graceful fallback for older free-text
  recipes.
- **Source URLs**: paste a recipe link and the recipe view embeds it, native
  embeds for YouTube / TikTok / Pinterest, and OG preview cards for Instagram
  and arbitrary web pages.

### Cooking log & rediscovery
- **Log every cook** as its own event with notes, photos, and an **effort level**
  (quick / easy / medium / high-effort).
- **Full searchable history** of everything you've cooked.
- **Rediscovery / "Ideas"**: surfaces meals worth cooking again, recent
  favorites, quick wins, and dishes you haven't made in a while.

### Sharing & household
- **Per-item sharing** ("Yours / Shared with you"): share a single recipe or
  plan with specific people at **view / edit / admin** levels.
- **Shared household ("Kitchen")** with member invitations.
- **People circle**: one-to-one connections you can share with.
- **Public read-only links**: "anyone with the link" view of a recipe or plan,
  no account needed.
- **Private by default**, nothing is shared until you choose to.

### Meal planning
- **Meal plans** you can build, clone, and (on higher tiers) share as a public
  page.
- Derived **combined shopping list** and **cooks invited** views.

### Onboarding & help (in-app)
- First-run **welcome modal**, a coached **spotlight tour** (desktop), and a
  searchable **Help slide-over** with per-feature guides + contextual "?" tips.

### Mobile
- **iOS/Android app (Expo / React Native), Phase 1**: magic-link auth and a
  Recipe Detail screen that renders structured recipes (with a legacy parser
  fallback). More features rolling out in subsequent phases. The full product
  today is the **web app** (works well on mobile browsers too).

## 6. Pricing & tiers

Four tiers. Annual is billed yearly at a lower effective monthly rate. Every
tier includes a monthly **AI-credit** grant; unused one-time top-up packs roll
over. **Every new account starts with a 7-day Master Chef trial, no card.**

| Tier | Price (monthly) | Annual (per-mo equiv) | AI credits / mo | What it unlocks |
|---|---|---|---|---|
| **Cook** (free) | $0 | $0 | 40 | Personal cooking library, logging, search, rediscovery, a taste of AI. No sharing, plans, or household. |
| **Chef** | $6.99 | $5.99 | 300 | Shared household + invites, meal plans (+ clone), public recipe links. |
| **Head Chef** *(Most popular)* | $11.99 | $9.99 | 750 | More AI room + priority, no burst limits. |
| **Master Chef** | $17.99 | $14.99 | 1,500 | Co-editing (family can edit your recipes & plans in place), shareable meal plans, priority AI. |

**Positioning of the ladder:** Cook = your private memory; Chef = share your
kitchen with family; Head Chef = heavy AI use; Master Chef = cook *together* in
real time.

### AI credit costs (what an action "spends")
A simple ladder so cost maps to effort:

| Action | Credits |
|---|---|
| Share-recipe card | 1 |
| Suggest from text · Refine from text | 2 |
| Extract ingredients | 3 |
| Suggest/Refine from voice or photo | 5 |
| Generate a dish image | 10 |

## 7. What makes it different (positioning angles)

- **Built for *families across distance*, not solo cooks.** The shared-kitchen +
  per-item sharing model is the core, not an afterthought. This is the wedge
  against generic recipe boxes (Paprika, AnyList) and creator-recipe apps.
- **Capture from the messy real world.** Voice notes, WhatsApp photos, links, or
  just a dish name, not "type in a clean recipe." This speaks directly to
  diaspora / multi-generational households.
- **Private by default, shared on purpose.** A trust angle: your family's
  recipes aren't a public feed. You decide exactly who sees each one.
- **A memory, not just storage.** Logging + rediscovery means the app gets more
  useful the more you cook, vs. a static recipe folder.
- **Honest AI.** Generated content is labeled a draft to verify, and there's
  always a free manual path, no credit dead-ends. Good trust story.

## 8. Trust / credibility notes (for "why it's real")

- Production web app live at **eeatly.com**; iOS/Android app in phased rollout.
- Modern, fast stack (Next.js, React, Postgres, Stripe). Magic-link sign-in plus
  optional Google. Photo uploads on a CDN.
- Privacy-respecting defaults (declines non-essential cookies; private-by-default
  sharing).

## 9. Current go-to-market status (as of v1.1.0)

- **Launch promo is active**: during launch, **every plan is unlocked free, no
  card required**, with the monthly credit grant floored at the launch level.
  Paid checkout is intentionally turned off until Stripe billing goes live; then
  it auto-reverts and users keep their library. Messaging is understated and
  honest ("free during launch, you'll keep your library and choose how to
  continue").
- Use this for an early-adopter / founding-cook acquisition push: "free during
  launch" is the current hook, not the long-term price.

## 10. Voice & copy rules (house style, apply to all marketing copy)

- **No em dashes (—) in any user-facing copy.** Use a comma, period, colon, or
  parentheses instead. (Enforced product-wide.)
- Tone: warm, plain-spoken, family-first; confident but not hypey. "A memory for
  everything you cook." Avoid chef/gourmet jargon, the user is an everyday home
  cook.
- Lead with the *family across distance* story; AI is a capability, not the
  headline.

## 11. Suggested marketing surfaces / asks for a strategist

When using this brief, good things to ask Claude for:
- Positioning statement + 3 audience-specific value props (diaspora families,
  the recipe-keeper, new parents).
- A messaging hierarchy (hero → 3 pillars → proof).
- Launch-promo campaign ("founding cooks, free during launch").
- Channel ideas: organic (TikTok/Reels recipe-capture demos), diaspora
  communities, app-store copy, referral within a household.
- SEO/content angles around "save family recipes," "recipe from a voice note,"
  "shared recipe app for family."

---

*Source of truth for numbers: `apps/web/lib/pricing.ts` (tiers, credits, trial)
and `CHANGELOG.md` (shipped features). Update this file when those change.*
