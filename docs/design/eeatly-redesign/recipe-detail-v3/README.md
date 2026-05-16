# Handoff: Recipe Detail screen + AI-prompted editing — eeatly mobile redesign

## Overview

This bundle covers the **Recipe Detail** screen and the **AI-prompted editing flow** that hangs off it. It is reached by tapping a recipe card from the Library or Home (most-cooked) sections. The user can:

1. Skim recipe metadata (who added it, how often it's been cooked, when last)
2. Tick off ingredients as a shopping checklist — each row shows the **quantity** and an optional prep note (e.g. "julienned")
3. Share or copy the shopping list as text
4. Follow the recipe as a numbered, ordered flow — each step has a title, a time estimate, a short instruction paragraph, and pills for the ingredients it uses. Cards are linked by a small “then” connector to make order explicit.
5. **Edit the recipe by prompting** — tap the pencil in the nav bar to land on a Refine surface that accepts text, voice, or photo input. Every prompt becomes a turn in a chat-style history; all changes batch into a single Review screen before saving.

There are two color modes — **light** (warm cream) and **dark** (warm near-black). Every screen in this bundle is designed in both.

## About the design files

The files in this bundle are **design references** — an HTML prototype showing intended look, layout, and content. They are *not* production code to copy verbatim. The implementation task is to **recreate this screen in the target codebase** (React Native, SwiftUI, Flutter, etc.) using its existing patterns, components, and theming system.

If the target codebase already has primitives for cards, chips, checkbox rows, bottom tab bar, etc., reuse them. If not, build them once and reuse — the eeatly redesign relies heavily on a small shared kit (Card, Chip, SectionLabel, IconBubble, NavBar, TabBar) which is documented below under **Shared primitives**.

## Fidelity

**High-fidelity (hifi).** All colors, type sizes, spacings, radii, and copy below are final and should be matched.

## Files in this bundle

| File | Purpose |
|---|---|
| `eeatly-screens.jsx` | Source for `ScreenRecipeDetail` (§12), `ScreenRefineRecipe` (§13), and `ScreenRefineReview` (§14). Also contains all other redesign screens for context. |
| `eeatly-shell.jsx` | Shared design tokens (`E_LIGHT`, `E_DARK`), fonts (`F`), icon set (`I`), and primitive components (`Phone`, `NavBar`, `TabBar`, `Card`, `Chip`, `IconBubble`, `MealTile`, `Content`). |
| `ios-frame.jsx` | iOS device-frame chrome. Reference only — the production app does not render its own bezel. |
| `_preview-tall.html` | Recipe Detail — light + dark side by side, full-length. |
| `_preview-single.html` | Recipe Detail — `?mode=light` or `?mode=dark`. |
| `_preview-refine.html` | Refine + Review screens — `?screen=refine-text\|refine-voice\|refine-photo\|review` and `?mode=light\|dark`. |
| `recipe-light.png` / `recipe-dark.png` | Recipe Detail — full-length captures. |
| `recipe-detail-overview.png` | Recipe Detail — light + dark side by side. |
| `refine-text-light.png` / `refine-text-dark.png` | Refine screen with the **text** input mode active. |
| `refine-voice-light.png` | Refine screen with the **voice** input mode active. |
| `refine-photo-light.png` | Refine screen with the **photo** input mode active. |
| `review-light.png` / `review-dark.png` | Review changes screen — full diff before save. |
| `refine-overview.png` | All four refine/review screens side by side. |

## Layout

### Hero block (top of screen)

- **NavBar** — sticky top, `cream` background, height 44 + 54px status-bar pad.
  - Title `Recipe` — body font, weight 600, 16px, color `ink`, centered.
  - Left: chevron-left (22px, color `forest`).
  - Right: pencil/edit icon (20px, color `forest`).
  - 1px hairline divider at the bottom in color `border` at 70% opacity.

- **Hero tile** — full-content-width, height **230px**, radius **14px**, margin-top 6, margin-bottom 20. Uses the `MealTile` component (a hashed-palette card with a giant italic display letter — see `MealTile` in `eeatly-shell.jsx`). For "Chowmein Noodles" the palette hashes to the **sage** swatch (light) / sage-dark (dark).

### Title block

Two-line editorial title.

```
Chowmein,         ← Instrument Serif italic, 18px, color ink2
Noodles.          ← Instrument Serif regular, 46px, line-height 0.98,
                    letter-spacing -0.02em, color ink
```

Below: mono caps meta line, **JetBrains Mono**, 11px, color `ink3`, letter-spacing 1.3px, uppercase:
`Added by alex.rivers · 1 cook · 4 days ago`

### Chip row

A flex-wrap row of three chips, gap 8, margin-bottom 26:

1. `Chip` tone=**sage**, icon = gauge (14px), label "Medium effort"
2. `Chip` tone=**ghost**, label "~30 min · serves 4"
3. `Chip` tone=**wheat**, label "5 steps"

Chip spec — see `Chip` in shell. Pill, height ~24px, padding `5px 11px 5px 10px`, font 12.5/600, `whiteSpace: nowrap`.

### Ingredients section

- **SectionLabel** "Ingredients" — body 11.5/600 uppercase, letter-spacing 1.4, color `ink2`. Margin-top 4, margin-bottom 12.
- Right-aligned `action` slot: mono caps "18 of 18 to buy" in `ink3`, letter-spacing 1.2, **nowrap**.
- Single `Card` (radius 14, border `borderSoft`, padding 0, overflow hidden) containing one row per ingredient. Rows are flex-aligned (center), padding `13px 16px`, separated by 1px `borderSoft` (skip the top border on row 0).
  - Checkbox: 20×20, radius 6, border 1.5px. Empty state border is `ink4`; checked state has `forest` border + `forest` fill + `forestText` check stroke (3px round-cap polyline).
  - **Name** (body 14.5/500, color `ink`) + optional **prep note** beside it in Instrument Serif italic, 11.5/400, color `ink3` (e.g. "julienned", "sliced thin"). The note follows the name in the same baseline row with an 8px gap.
  - **Quantity** — right-aligned, JetBrains Mono 11.5/400, color `ink2`, letter-spacing 0.4, `whiteSpace: nowrap`. Examples: `400 g`, `1 tsp`, `2 cups`.
  - When checked: name color shifts to `ink3`, label gets `line-through` in `ink4`, and the quantity is also struck through in `ink4`.

The ingredient list for this recipe (in order, with quantities + prep notes):

| Ingredient | Qty | Prep |
|---|---|---|
| Chicken | 400 g | boneless, sliced |
| Salt | 1 tsp | — |
| Red pepper | ½ tsp | — |
| Black pepper | ½ tsp | — |
| Garlic powder | 1 tsp | — |
| Onion powder | 1 tsp | — |
| Paprika powder | 1 tsp | — |
| Cumin powder | ½ tsp | — |
| Ketchup | 3 tbsp | — |
| Sriracha | 1 tbsp | — |
| Chilli garlic sauce | 1 tbsp | — |
| Soy sauce | 2 tbsp | — |
| Vinegar | 1 tbsp | — |
| Carrot | 1 large | julienned |
| Bell pepper | 1 | sliced thin |
| Cabbage | 2 cups | shredded |
| Onions | 1 medium | sliced |
| Noodles | 250 g | boiled, drained |

### Shopping list actions

Below the ingredient card, a 2-button row (flex, gap 10, margin-bottom 30):

1. **Share shopping list** — flex 1, height ~44, pill (radius 99), background `sageBg`, color `forest` (light) or `forestSoft` (dark). Body 13.5/600. Icon: upload arrow, 16px.
2. **Copy** — pill, transparent bg with 1px `border` outline, color `ink`. Icon: stacked rectangles "copy" glyph, 16px.

### Recipe steps

- **SectionLabel** "Recipe" with a right-aligned mono-caps action "FOLLOW IN ORDER" (JetBrains Mono 10.5, color `ink3`, letter-spacing 1.2).
- Column of `Card`s (padding 18, gap 14). Each card:
  - **Header row** — flex, `alignItems: baseline`, gap 12, margin-bottom 8:
    - Italic numeral `1.` / `2.` / … in Instrument Serif italic, **32px**, color `forest` (light) / `forestSoft` (dark). `minWidth: 28`.
    - Right side stacks two lines:
      - Step title — Instrument Serif **regular**, 22px, line-height 1.05, color `ink`.
      - Time estimate — JetBrains Mono 10.5, color `ink3`, letter-spacing 1.2, uppercase. E.g. `10 MIN · THEN 20 MIN REST`.
  - **Instruction body** — body 14/400, line-height 1.5, color `ink2`, `textWrap: pretty`. Indented to align with the title column (`marginLeft: 40`). Margin-bottom 12.
  - **Ingredient pills** — `flex-wrap` row of pills, gap 6, also indented `marginLeft: 40`:
    - Pill: padding `5px 10px`, radius 99, background `cream`, 1px border `borderSoft`, body 12.5/500, color `ink2`.
  - **“Then” connector** — between cards (i.e. on every card except the last), an inline row inside the card with a 14px down-arrow icon + the mono-caps word **“THEN”** in `ink4`, color `ink4`, indented `marginLeft: 12`, `marginTop: 14`. Visually links the card to the next.

Step contents (the full ordered flow):

| # | Title | Time | Instruction (verbatim) | Ingredients used |
|---|---|---|---|---|
| 1 | Marinate the chicken | 10 min · then 20 min rest | Combine the chicken with salt, both peppers, garlic, onion, paprika and cumin. Toss until evenly coated and rest for 20 minutes while you prep the rest. | Chicken, Salt, Red pepper, Black pepper, Garlic powder, Onion powder, Paprika powder, Cumin powder |
| 2 | Mix the sauce | 2 min | Whisk ketchup, sriracha, chilli garlic sauce, soy sauce and vinegar in a small bowl until smooth. Set aside within arm’s reach of the stove. | Ketchup, Sriracha, Chilli garlic sauce, Soy sauce, Vinegar |
| 3 | Prep the vegetables | 8 min | Julienne the carrot, slice the bell pepper and onion thin, and shred the cabbage. Keep them on one plate — they all go in together. | Carrot, Bell pepper, Cabbage, Onions |
| 4 | Sear the chicken | 6 min | Heat a wok over high heat. Add the marinated chicken in one layer, sear undisturbed for 2 minutes, then toss until just cooked through. Move to a plate. | Chicken |
| 5 | Stir-fry & toss | 5 min | In the same wok, fire the vegetables for 2 minutes on high — they should stay crisp. Return the chicken, add the boiled noodles and pour in the sauce. Toss for a minute until everything is glossy. | Carrot, Bell pepper, Cabbage, Onions, Noodles, Chicken |

### Primary CTA

Full-width button, padding 16, pill (radius 99), background `forest`, color `forestText`, body 15.5/600. Centered row: cutlery icon (20px) + label "Log a cook". Inset 1px white-8% highlight on top.

### Bottom tab bar

Standard 3-tab bar from the rest of the redesign — Home, Add, **Library** (active here, since the user came from Library). See `TabBar` in shell.

## Refine recipe (AI editing)

Reached by tapping the pencil icon in the Recipe Detail nav bar. Same screen is also used as the post-AI-capture review surface (when a user creates a recipe via `ScreenCaptureAI`, they land on Refine pre-filled with the extracted draft).

The entire screen is built around a single conviction: **prompting is the primary editing mode**. Voice/text/photo input is the headliner; per-field manual editing is a one-tap fallback.

### Screen 13 — `ScreenRefineRecipe`

Props: `{ dark?: boolean; mode?: 'text' | 'voice' | 'photo' }`.

Top-to-bottom anatomy:

1. **NavBar** — left chevron-back, title "Refine recipe", right action "Discard" (mono-style 14/600, color `ink3` until there are pending changes — then becomes `danger`).
2. **Identity strip** (margin-top 6, margin-bottom 18). Pill-shaped card showing what's being edited:
   - 44×44 `MealTile` (radius 8)
   - Stack: meal name in Instrument Serif 18, then mono caps meta `18 INGREDIENTS · 5 STEPS · MEDIUM` in `ink3`
   - Right pill chip "EDITING" in wheat tone (mono 10/600, bg `#F4EEDB` light / `rgba(217,198,140,0.16)` dark)
3. **Prompt composer card** (margin-bottom 14) — the hero:
   - Background sage tint `#EDEEDF` light / `sageBg` dark, radius 22, padding `20px 18px 16px`
   - Faint dotted pattern overlay (radial-gradient dots at 14px grid, ~8% opacity)
   - Header row: sparkle icon + mono caps eyebrow `TELL ME WHAT TO CHANGE`
   - Display headline: “Add an ingredient, fix a quantity, rewrite a step.” (Instrument Serif 26, line 1.05, `ink`)
   - **Mode tabs** — pill segment, three options: `Text` / `Voice` / `Photo`. Active = `forest` bg + `forestText`; inactive = transparent + `ink2`. Each tab is 13/600 with its glyph (`document` / `mic` / `camera`, 14px) to the left.
   - **Input surface** swaps by tab:
     - **Text** — white card, radius 16, 1px `border`. Italic-display placeholder “e.g. “Bump the chicken to 600 g and add ginger paste, 1 tbsp.”” (14.5/Instrument Serif italic, `ink3`). Bottom row separated by 1px `borderSoft`: left = inline icon buttons (`camera`, `image`, `mic`) in `ink3`; right = 32px round send button (forest bg, white up-arrow icon).
     - **Voice** — white card, padded `22px 14px`, column-centered. 68px round forest mic button, then a fake live waveform (16 vertical bars, varying heights 6–20px, 3px wide, color `forest`/`forestSoft`, fading opacity), then mono caps `0:04 · LISTENING` in `ink3`.
     - **Photo** — dashed-border well (1.5px dashed, repeating-linear-gradient hatch overlay), 28px camera icon in `forest`, label “Snap a change” (14.5/600), mono caps subline `HANDWRITTEN NOTE · STICKY · COOKBOOK PAGE`.
   - **Example chips** — wrap row, gap 6, margin-top 12. Four chips: “Make it spicier”, “Convert to grams”, “Halve for 2 people”, “Add prep notes”. 12/500 in `ink2`, padding `6px 11px`, radius 99, bg `rgba(255,255,255,0.6)` light / `rgba(0,0,0,0.25)` dark.
4. **“This session” — chat history of prior turns** (between composer and pending-changes summary). SectionLabel “THIS SESSION” with right action “2 TURNS” in mono caps. Each turn is a pair:
   - **User bubble** — right-aligned, max-width 78%. Bg `forest` light / `sageBg` dark; text `forestText` light / `forestSoft` dark. Radius 18 with bottom-right radius 4 (chat-tail). 10/14 padding. Starts with a 14px input-mode glyph (mic / document / camera) inline left, then the prompt text in body 14.
   - **AI reply card** — a `Card` with `paper` bg (light) or `surface` (dark). Header row = sparkle icon + mono caps `PROPOSED · N CHANGES`. Body = `DiffRow`s.
     - **DiffRow** anatomy: 18px round dot on the left, then label + optional mono-caps secondary note.
       - `kind='add'` — dot bg `sageBg`, fg `forest`, plus-glyph
       - `kind='change'` — dot bg `#F4EEDB` light / `#2A2A1F` dark, fg `#8A6B22` light / `wheat` dark, right-arrow glyph
       - `kind='remove'` — dot bg `dangerSoft`, fg `danger`, minus-glyph; label gets `line-through` in `ink4`
5. **Pending changes summary** — SectionLabel “PENDING CHANGES” with right action “Or edit by hand →” (12.5/500, `ink3`). Card padding 14:
   - Top row: `4 changes ready` (13.5/600) + two count pills: `+2` (sage) and `~2` (wheat)
   - Body copy: “We'll roll all your refinements into one save. Review them in the next step before they overwrite the recipe.” (12.5/`ink2`/line-height 1.5)
6. **Primary CTA** — full-width pill button. `forest` bg, `forestText` color, 16px padding, 15.5/600. Center row: “Review & save” + a count-badge pill (`{n}`, 12/700, bg `rgba(255,255,255,0.18)` light / `rgba(16,24,15,0.22)` dark). The CTA is the only path to the diff review screen.
7. **TabBar** — `active="library"` (the entry point is from Recipe Detail which sits under Library).

#### The three input modes are independent artboards in the canvas

Three mode variants of the same component sit in the canvas (`Refine · text`, `Refine · voice`, `Refine · photo`). Only the **input surface inside the composer card** changes; identity strip, example chips, chat history, pending changes, and CTA are identical. In production this is one screen with internal tab state — not three routes.

### Screen 14 — `ScreenRefineReview`

Props: `{ dark?: boolean }`. Reached from the “Review & save” CTA.

1. **NavBar** — left link “Back” (forest, 15/500), title “Review changes”, right link “Save” (forest, 15/600). Right link is the primary commit; the bottom CTA is a duplicate for thumb reach.
2. **Editorial headline** — two-line, same pattern as the Recipe Detail title:
   - Italic display 18 — “4 changes,” (color `ink2`)
   - Display 40, line 0.98, letter-spacing -0.02em — “ready to save.” (color `ink`)
   - Mono caps subline — `CHOWMEIN NOODLES · REFINED JUST NOW`
3. **Totals chip row** — three `Chip`s, margin-bottom 22: `+2 additions` (sage), `~2 changes` (wheat), `0 removals` (ghost).
4. **Diff list** — SectionLabel “DIFF” with right action “Accept all” (12.5/600, `forest`). One `Card` (padding 0, overflow hidden) containing N rows separated by 1px `borderSoft`. Each row:
   - 22×22 round dot on the left (same color system as DiffRow above)
   - Body title (13.5/600, `ink`) + mono caps secondary `Added · Step 6 · new step`
   - Right chevron (16px, `ink3`)
   - **Indented mono diff** (`marginLeft: 32`): before-line is JetBrains Mono 12.5, color `ink3`, with `line-through` in `ink4`; after-line is mono 12.5/600, color `ink2`.
5. **Heads-up note** — sage-tinted card (`#EDEEDF` light / `sageBg` dark), 14/16 padding, radius 14, 1px sage border. Sparkle icon (18px) left + stacked title “Heads up” (13/600) + body explaining a knock-on effect (effort bump from medium → high). Inline `<span>`s pull effort tokens out in `ink`/600.
6. **Footer actions**:
   - Primary: `forest` pill button, “Save 4 changes” with a checkmark icon left.
   - Secondary: outline-border pill, “Keep refining” — returns to Refine without discarding.

## Design tokens (shared across all eeatly screens)

### Colors — light (`E_LIGHT`)

| Token | Hex | Usage |
|---|---|---|
| `cream` | `#F5EFE2` | Screen background |
| `creamSoft` | `#EFE7D6` | Dashed-photo wells |
| `paper` | `#FBF6EA` | Sheets, modals |
| `surface` | `#FFFFFF` | Cards |
| `ink` | `#1A1F1A` | Primary text |
| `ink2` | `#5F665B` | Secondary text |
| `ink3` | `#9C9787` | Meta / placeholder |
| `ink4` | `#C7C1B0` | Disabled / strikethrough |
| `forest` | `#2E5739` | CTA bg, brand accents, links |
| `forestSoft` | `#3C6B47` | — (used in dark) |
| `forestText` | `#F5EFE2` | Text on forest CTAs |
| `sageBg` | `#E3E8D5` | Subtle sage tint (icon bubbles, ghost CTAs) |
| `sage` | `#D4DCC5` | Sage chip bg |
| `wheat` | `#D9C68C` | Avatar bg |
| `terra` | `#C66B47` | Reserved accent |
| `border` | `#E6DCC4` | Hairline borders |
| `borderSoft` | `#EEE5D0` | Soft dividers inside cards |
| `danger` | `#A8413A` | Destructive |
| `dangerSoft` | `#F0DBD8` | Destructive bg |

### Colors — dark (`E_DARK`)

| Token | Hex |
|---|---|
| `cream` | `#15140F` |
| `creamSoft` | `#1C1A14` |
| `paper` | `#1A1812` |
| `surface` | `#1F1D17` |
| `ink` | `#F0E9D9` |
| `ink2` | `#A8A28F` |
| `ink3` | `#736F5E` |
| `ink4` | `#3A382E` |
| `forest` | `#88B894` (used as CTA bg — lighter sage-green) |
| `forestSoft` | `#A1CBA9` |
| `forestText` | `#10180F` (dark text on light CTA) |
| `sageBg` | `#2A3022` |
| `border` | `#2D2B22` |
| `borderSoft` | `#26241D` |
| `danger` | `#D88078` |
| `dangerSoft` | `#3A211E` |

### Typography (`F`)

| Role | Family | Notes |
|---|---|---|
| Display | `Instrument Serif`, fallback `Cormorant Garamond`, Georgia, serif | Used for titles, italic accents, big numerals |
| Body | `Geist`, system fallbacks | Default UI text |
| Mono | `JetBrains Mono`, monospace | Caps meta lines |

Google Fonts import:
```
https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap
```

### Type scale used on this screen

| Element | Family | Size | Weight | Line | Tracking |
|---|---|---|---|---|---|
| NavBar title | Body | 16 | 600 | 1 | -0.1 |
| Title overline ("Chowmein,") | Display italic | 18 | 400 | 1.05 | 0.1 |
| Title ("Noodles.") | Display | 46 | 400 | 0.98 | -0.02em |
| Mono meta | Mono | 11 | 400 | 1.4 | 1.3px uppercase |
| Chip label | Body | 12.5 | 600 | 1 | 0.1 |
| Section label | Body | 11.5 | 600 | 1 | 1.4px uppercase |
| Section action (mono) | Mono | 10.5 | 400 | 1 | 1.2px uppercase |
| Ingredient row | Body | 14.5 | 500 | 1.2 | -0.1 |
| Action button | Body | 13.5 | 600 | 1 | -0.1 |
| Step numeral | Display italic | 32 | 400 | 1 | -0.02em |
| Step title | Display | 22 | 400 | 1.05 | -0.02em |
| Step ingredient pill | Body | 12.5 | 500 | 1 | -0.05 |
| Primary CTA | Body | 15.5 | 600 | 1 | -0.1 |

### Spacing & radii

- Phone canvas: **393 × 852** (iPhone 17 Pro logical viewport)
- Screen horizontal padding: **22px** (passed as `pad={22}` to `Content`)
- Card radius: **14**
- Pill radius: **99**
- Checkbox radius: **6**
- Hero tile radius: **14**
- Card shadow (light): `0 1px 0 rgba(60,40,10,0.02), 0 4px 18px -10px rgba(40,30,10,0.08)`
- CTA shadow (light): `0 6px 20px rgba(31,61,41,0.35)`

## Shared primitives referenced

All defined in `eeatly-shell.jsx`. The same dev should NOT re-implement these per-screen — they are the reusable shell.

| Component | Props | Behavior |
|---|---|---|
| `Phone` | `dark`, `bg`, children | The screen container — applies theme, font, status pad. In production this is just the screen root with safe-area insets. |
| `NavBar` | `title`, `left`, `right`, `divider`, `bg` | Sticky top bar. |
| `TabBar` | `active` | Bottom 3-tab nav (Home / Add / Library). Active tab gets sage pill + filled icon + forest color. |
| `Content` | `pad` (px), children | Scrolling content area. Bottom padding 110px to clear tab bar. |
| `Card` | `padding`, `style`, children | White (light) or warm-dark (dark) card with hairline border + soft shadow. |
| `Chip` | `tone` ('sage' \| 'wheat' \| 'terra' \| 'ghost'), `icon`, children | Pill chip with `whiteSpace: nowrap`. |
| `IconBubble` | `size`, `bg`, `fg`, children | Round plaque for an icon. |
| `MealTile` | `name`, `size`, `radius` | Auto-colored placeholder tile with hashed palette and giant italic first letter. Fallback when there is no user photo. |

## Interactions

### Recipe Detail

| Trigger | Behavior |
|---|---|
| Tap back chevron | Pop to previous screen (Library / Home). |
| Tap edit icon (top-right) | Push **`ScreenRefineRecipe`** (mode='text' by default). |
| Tap a checkbox row | Toggle `ingredient.bought`. The card row, checkbox fill, and label-strikethrough update. The `N of M to buy` action label decrements. |
| Tap **Share shopping list** | Build a plain-text list of unchecked ingredients (`- Chicken\n- Salt\n…`) and open the native share sheet. |
| Tap **Copy** | Copy the same plain-text list to clipboard. Show a brief toast/snackbar ("Copied"). |
| Tap **Log a cook** | Open the **Log a meal** screen (screen 7 in the redesign) with the recipe name prefilled. After save, this screen's "Cooked N · last cooked X" updates. |
| Tap a tab in the bottom bar | Navigate to that tab's root. |

### Refine recipe

| Trigger | Behavior |
|---|---|
| Tap a mode tab (`Text` / `Voice` / `Photo`) | Swap the input surface inline. No route change. Persist the active mode in session state so navigating away and back keeps the user where they were. |
| Tap the send button (text mode) | Submit the typed prompt. Replace the textarea with a loading shimmer, then prepend the result as a new turn at the bottom of the chat history. Increment the pending count on the CTA. |
| Hold the mic (voice mode) | Start recording. Show the live waveform (real-time mic level, not the fake one in the mock). Release → same submit flow as text. |
| Tap the camera tile (photo mode) | Open camera/photo library. Selected image becomes the prompt input. |
| Tap an example chip | Submit that chip's text as the next prompt. |
| Tap a user bubble in chat history | Re-open that prompt in the composer for editing (“undo & rewrite”). |
| Tap an AI reply card | Open a sheet listing the proposed changes individually so the user can accept/reject one at a time. (Out of scope for this hand-off; reuse the diff-row pattern from Review.) |
| Tap “Or edit by hand →” in PENDING CHANGES | Switch the lower half of the screen into per-field edit mode (out of scope; treat as future work). |
| Tap **Review & save** | Push `ScreenRefineReview` with the accumulated batch. |
| Tap **Discard** in nav | Confirm-then-discard all pending changes and pop back to Recipe Detail. |

### Refine review

| Trigger | Behavior |
|---|---|
| Tap a diff row's chevron | Drill into a row-detail sheet that lets the user accept or reject just that one change. |
| Tap **Accept all** | Mark every pending change as accepted (no-op for the mock; in production this is the default state). |
| Tap **Save 4 changes** / nav-right **Save** | Commit all pending changes to the recipe. Pop back to Recipe Detail; show a toast “Recipe updated”. |
| Tap **Keep refining** | Return to `ScreenRefineRecipe`, preserving the pending batch so the user can add more prompts. |
| Tap **Back** in nav | Same as Keep refining. |
| Tap the **Heads up** note | Open a one-question sheet asking whether to keep effort=medium or auto-bump to high. (Out of scope; treat as future work.)

## State needed (per-recipe)

```ts
type RecipeDetail = {
  id: string;
  name: string;                 // "Chowmein Noodles"
  addedBy: { username: string };
  cookCount: number;            // 1
  lastCookedAt: Date | null;    // 4 days ago
  effort: 'quick' | 'easy' | 'medium' | 'high';
  ingredients: Array<{ id: string; label: string; bought: boolean }>;
  steps: Array<{
    title: string;              // "Marinate the chicken"
    time?: string;              // "10 min · then 20 min rest" — free-form, rendered as-is in mono caps
    body: string;               // The instruction paragraph rendered under the header
    ingredientIds: string[];    // refs into ingredients[]
  }>;
};

// Each ingredient row
type Ingredient = {
  id: string;
  name: string;                 // "Carrot"
  qty: string;                  // "1 large" — free-form, mono-rendered as-is
  note?: string;                // "julienned" — optional prep note in italic
  bought: boolean;
};
```

- The `bought` flag on each ingredient should persist locally (so leaving and returning to the screen retains check state) but is treated as ephemeral shopping-list state, NOT part of the recipe definition. Reset action is out of scope.
- `lastCookedAt` is derived from a separate `cook_log` table; bumping it is what **Log a cook** does.

## State needed (refine session)

A refine session is a draft layered on top of `RecipeDetail`. The original is not mutated until the user hits **Save** on the Review screen.

```ts
type RefineSession = {
  recipeId: string;             // which recipe is being edited
  turns: RefineTurn[];          // chat history, ordered
  pending: PendingChange[];     // flattened diff to apply on save
  startedAt: Date;
};

type RefineTurn = {
  id: string;
  source: 'text' | 'voice' | 'photo';
  prompt: string;               // user text (transcribed for voice, OCR caption for photo)
  attachment?: { kind: 'audio' | 'image'; url: string };
  proposed: PendingChange[];    // what the AI suggested for this turn
  accepted: boolean;            // user accepted (default true; can flip from review)
  createdAt: Date;
};

type PendingChange =
  | { kind: 'add';    target: 'ingredient' | 'step'; payload: Partial<Ingredient> | Partial<Step>; where?: string }
  | { kind: 'change'; target: 'ingredient' | 'step' | 'meta'; refId: string; before: any; after: any; field: string }
  | { kind: 'remove'; target: 'ingredient' | 'step'; refId: string };
```

- A session is local until **Save**, at which point `pending` is applied to the underlying `RecipeDetail` and the session is cleared.
- **Discard** clears `turns` and `pending` and pops.
- Multiple users in the same kitchen should NOT share refine sessions — sessions are per-device-per-recipe.
- Voice mode needs a transcript before submission; show it in the user bubble verbatim. Don't auto-translate.
- Photo mode runs the same recipe-extraction model as `ScreenCaptureAI` and diffs the result against the current recipe.

## Notes for the implementer

- **Don't ship the iOS bezel.** The frame in `_preview-*.html` is for review only. In React Native / SwiftUI / Flutter, render the screen content directly inside the platform's safe-area-aware screen root.
- **Reuse the shared kit.** `Card`, `Chip`, `SectionLabel`, `IconBubble`, `NavBar`, `TabBar` should be one set of primitives shared with every other screen in the redesign. Don't fork them per-screen.
- **The two-line title** uses two stacked text nodes (an italic overline + the bold main word), not a single wrapped string. Split the recipe name editorially — pick a comma break or a natural pause. For single-word titles, the overline can be omitted or replaced with the cuisine.
- **The italic step numeral** ("1.", "2.") is part of the display family — don't use a regular numeric. The combination of italic numeral + roman title is the screen's most distinctive type pairing.
- **Quantity strings are intentionally free-form** (`400 g`, `½ tsp`, `2 cups`, `1 large`). Render them as-is in JetBrains Mono — do not parse into number+unit unless you need to support unit conversion. If you do, store the parsed form alongside the display string, not in place of it.
- **Step ordering is meaningful.** The “then” connector and “FOLLOW IN ORDER” label are there to make the flow explicit; don’t reorder steps alphabetically or by ingredient count.
- **Time estimates** are also free-form strings rendered in mono caps. Some are compound ("10 min · then 20 min rest"). Don’t sum them — the chip "~30 min" at the top is a hand-tuned total that includes overlapping prep.
- **Empty states** (no ingredients yet, no steps yet) aren't in scope here but should reuse the empty-hint pattern from `ScreenPlans` (italic display tagline + max-width 260 caption).
- **Refine is the same engine as Capture-with-AI.** The model behind the prompt composer should be identical to the one used in `ScreenCaptureAI`; the only difference is that Refine attaches the current `RecipeDetail` as context so the model can diff instead of extract from scratch. If you split them into two backend prompts, keep the response schema (`PendingChange[]`) identical.
- **Don't auto-save AI proposals.** Every turn must batch into `pending` and require an explicit Save action. Users will reject AI proposals; surprise overwrites destroy trust in the editor.
- **Show the input mode in the user bubble.** The leading 14px icon (`mic` / `document` / `camera`) is load-bearing — it tells the user *how* they made each change. Don't drop it for brevity.
- **The “Heads up” note in Review is rule-based, not AI-generated.** Trigger it when a pending change crosses a known threshold: chicken weight bumping effort tier, ingredient count exceeding effort tier, total time crossing the chip's hand-tuned bucket. Keep the rules in a small lookup table; don't ask the model.

## Companion files

If you also need:
- Other screens in the same redesign — see `eeatly-screens.jsx` for `ScreenHome`, `ScreenPlans`, `ScreenAdd`, `ScreenLibrary`, etc.
- The original prototype in context — `eeatly Mobile Redesign.html` in the parent project renders all screens on a pannable canvas with light + dark variants.
