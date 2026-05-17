# Handoff: eeatly Mobile Redesign

## Overview

A visual + interaction polish pass on **eeatly**, a personal household meal-logging and recipe-keeping iOS app. The redesign cleans up the existing flow without changing the information architecture — same three tabs (Home / Add / Library), same plans + meal-logging + AI-capture features — and elevates the visual language from "generic productivity app" to "warm editorial cookbook."

This package covers all 11 primary screens, plus a complete **dark mode** variant.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. The task is to **recreate these designs in the eeatly app's existing native environment** (presumably SwiftUI given the iOS 17/18-era screenshots), using its established patterns, navigation primitives, and component library. If the existing implementation is React Native or Flutter instead, the same principles apply — match the patterns already in the codebase.

Open `eeatly Mobile Redesign.html` in a browser to see all 21 artboards (11 light + 10 dark) on a pan/zoomable canvas. Double-click any artboard to enter fullscreen focus mode; press `←` / `→` to move between artboards in a section, `Esc` to exit.

## Fidelity

**High-fidelity.** All colors, typography, spacing, radii, and shadows are final. Layout proportions and component sizes are precise. Copy is final unless flagged. The only thing intentionally placeholder-ish is the photo-upload empty state (a striped dashed-border drop zone) and avatar imagery (we use typographic monograms — keep them as the empty state, replace with real photos when uploaded).

## Design system

### Color tokens

All colors are warm-neutral. **Saturation stays low** — there's no pure white, no pure black, and no jewel tones.

#### Light theme

| Token | Hex | Use |
|---|---|---|
| `cream` | `#F5EFE2` | App background |
| `creamSoft` | `#EFE7D6` | Subtle alt bg (dashed photo zone) |
| `paper` | `#FBF6EA` | Bottom-sheet surface |
| `surface` | `#FFFFFF` | Cards, inputs |
| `ink` | `#1A1F1A` | Primary text |
| `ink2` | `#5F665B` | Secondary text |
| `ink3` | `#9C9787` | Tertiary text, placeholder, inactive icons |
| `ink4` | `#C7C1B0` | Sheet handle, very subtle dividers |
| `forest` | `#2E5739` | Primary CTAs, active states, brand |
| `forestDeep` | `#1F3D29` | Pressed states (optional) |
| `forestSoft` | `#3C6B47` | (Reserved) |
| `forestText` | `#F5EFE2` | Text on forest CTAs |
| `sage` | `#D4DCC5` | (Light tint variant) |
| `sageDeep` | `#BFCBB1` | (Light tint variant) |
| `sageBg` | `#E3E8D5` | Active tab pill, icon-bubble bg, sage chip |
| `terra` | `#C66B47` | Reserved warm accent |
| `wheat` | `#D9C68C` | Member avatar bg |
| `border` | `#E6DCC4` | Card borders, input borders |
| `borderSoft` | `#EEE5D0` | Soft inner dividers, card edges |
| `danger` | `#A8413A` | Destructive text |
| `dangerSoft` | `#F0DBD8` | Destructive button bg |

#### Dark theme

Same role mapping, retuned for a warm-black ground. The primary CTA flips: dark mode's button bg is the lighter `forest`/`forestSoft` with dark text on top, so CTAs still feel buttony at a glance.

| Token | Hex | Notes |
|---|---|---|
| `cream` | `#15140F` | App background (warm near-black) |
| `creamSoft` | `#1C1A14` |  |
| `paper` | `#1A1812` | Sheet surface |
| `surface` | `#1F1D17` | Cards, inputs |
| `ink` | `#F0E9D9` | Primary text |
| `ink2` | `#A8A28F` | Secondary text |
| `ink3` | `#736F5E` | Tertiary text |
| `ink4` | `#3A382E` | Handle, subtle dividers |
| `forest` | `#88B894` | CTA bg (lighter sage-green) |
| `forestSoft` | `#A1CBA9` | Accent icon color, link color |
| `forestText` | `#10180F` | Dark text on forest CTAs |
| `sageBg` | `#2A3022` | Active tab pill, icon-bubble bg |
| `wheat` | `#C9B176` | Member avatar bg |
| `border` | `#2D2B22` | Card/input borders |
| `borderSoft` | `#26241D` | Inner dividers |
| `danger` | `#D88078` |  |
| `dangerSoft` | `#3A211E` |  |

#### Meal-tile palettes (both themes)

Meal monogram tiles pick a palette deterministically from `hash(dishName) % 6`. Same dish always gets the same tile.

**Light tiles** — bg / fg / dotted-texture color:
1. Sage: `#D7DEC8` / `#2E5739` / `#A8B79A`
2. Terracotta: `#E9D6C2` / `#7C3F1F` / `#D2A984`
3. Wheat: `#E2DDC4` / `#665225` / `#C8B98B`
4. Mint: `#CBD9CF` / `#2E4F45` / `#9DB1A6`
5. Rose: `#E5D2CE` / `#7A3D3D` / `#C9A8A4`
6. Indigo: `#D4D7E0` / `#3A4566` / `#A9AEC0`

**Dark tiles** — bg / fg / dotted-texture color:
1. Sage: `#384535` / `#C7D5B5` / `#52613F`
2. Terracotta: `#4A3525` / `#E5C09E` / `#6B4A30`
3. Wheat: `#3D3722` / `#D9C68A` / `#5C5230`
4. Mint: `#2F3F39` / `#A8C7BB` / `#4A5E55`
5. Rose: `#3F2D2C` / `#D9B4B0` / `#5C413F`
6. Indigo: `#2F3548` / `#B5BED5` / `#454C66`

### Typography

Three families, loaded from Google Fonts.

| Role | Family | Weights | Notes |
|---|---|---|---|
| Display | **Instrument Serif** | 400, italic 400 | Used italic for "Good evening," small italic kickers; upright for big titles. Letter-spacing `-0.02em` on display sizes. |
| Body / UI | **Geist** | 400, 500, 600, 700 | Default font. Letter-spacing `-0.1px` to `-0.15px` on titles, 0 elsewhere. |
| Metadata | **JetBrains Mono** | 400, 500, 600 | Dates, counts, eyebrow labels. Always uppercase with `letter-spacing: 1.4–1.5` for small sizes. |

Type scale used:

| Size (px) | Family | Weight | Role |
|---:|---|---|---|
| 56 / 46 / 44 | Instrument Serif | 400 | Page titles (`Saif.`, `Eid Al Adha`, `Plans`) |
| 36 | Instrument Serif | 400 | Sub-display (Capture a recipe.) |
| 28 | Instrument Serif | 400 | Sheet title, hero card title |
| 22 / 18 | Instrument Serif | 400 italic | Editorial kicker ("Good evening,"), empty-state quotes |
| 16 | Geist | 600 | Nav title, card titles |
| 15 / 14.5 | Geist | 600 / 500 | Body labels, list items |
| 14 | Geist | 400 / 600 | Body text, field labels |
| 13.5 | Geist | 600 | Tab buttons, small CTAs |
| 12.5 | Geist | 600 | Chips, small links |
| 11.5 | Geist | 600 | UPPERCASE section labels (`SectionLabel`, eyebrow) |
| 11–10.5 | JetBrains Mono | 500 / 600 | Date/meta lines (always uppercase, letter-spacing 1.3–1.5) |

### Spacing & radii

- Screen horizontal padding: **22px**
- Card padding: **14–16px** (use 14 for tighter list cards, 16 for content cards)
- Vertical rhythm between sections: **22–28px**
- Card radius: **12–14px** (12 for inputs/list cards, 14 for content cards, 18 for hero cards)
- Pill radius: **99px** (CTAs, chips, tabs, search bar)
- Tile radius: **6–10px** depending on tile size (smaller tile → tighter corner)
- Bottom-sheet radius: **22px** top-only

### Shadows

- **Card** light: `0 1px 0 rgba(60,40,10,0.02), 0 4px 18px -10px rgba(40,30,10,0.08)`
- **Card** dark: `0 1px 0 rgba(0,0,0,0.25), 0 4px 18px -10px rgba(0,0,0,0.5)`
- **CTA** light: `0 6px 20px rgba(31,61,41,0.35)` (forest-tinted)
- **CTA** dark: `0 6px 20px rgba(0,0,0,0.45)`
- Sheet: `0 -20px 40px -10px rgba(20,20,15,0.18)` (light), `…rgba(0,0,0,0.5)` (dark)

### Iconography

All icons hand-drawn as **stroke SVG** at `1.6–1.8px` stroke width, `stroke-linecap: round`, `stroke-linejoin: round`. They inherit `currentColor`. Sizes: 16, 18, 20, 22. The 28px camera icon is the only exception (hero card).

If the codebase already uses an icon set (Lucide, SF Symbols, Phosphor), substitute one-for-one with matching outline icons at the same stroke weight. Names referenced in screens:

- `gear`, `home`, `home.fill`, `book`, `book.fill`, `plus`, `plus.circle`, `plus.circle.fill`
- `chevron.left`, `chevron.right`, `pencil` (edit), `calendar`, `sparkle`, `link`, `mic`, `document`, `camera`, `image` (photo placeholder), `lightbulb`, `gauge`, `person.badge.plus`, `external` (arrow-up-right-square), `magnifyingglass` (search), `fork.knife`

### Monogram meal tile — **the signature element**

Every meal/dish thumbnail throughout the app is a **typographic monogram tile**, not a photo or generic fork-knife icon. Spec:

- Tile is a colored square (`background-color` from palette).
- Single letter — the first character of the dish name, uppercased — rendered in **Instrument Serif italic**, weight 400, color = palette `fg`, line-height 0.9, letter-spacing `-0.04em`, font size scales with tile (124 / 96 / 64 / 40 for xl / lg / md / sm). Slight optical centering: `margin-top: -0.08em`.
- Behind the letter: a faint dotted texture using `radial-gradient(circle, {dot}55 1px, transparent 1.4px)` at `14×14` background-size, opacity 0.55.
- Hairline inner frame: `inset: 6px`, `border: 1px solid {dot}66`, same radius as tile minus 2.
- Palette index = `hash(dishName) % 6`. Hash is a simple 31-multiplier rolling hash; any stable hash works.
- Same dish hashes to the same tile across Home, Plans, Library — this is a feature, not coincidence.

When the user uploads a real photo for a dish, the photo replaces the monogram tile (same dimensions, same rounded corners, same hairline frame optional). The monogram is the default empty state.

## Screens

All screens are 393pt × 852pt (iPhone 17 Pro logical resolution). Status bar (≈54pt) and home indicator (≈34pt) are owned by the system. Bottom tab bar height ≈ 76pt + safe area.

### 1. Home (`ScreenHome`)

- Top nav: title "Home" centered, gear icon top-right (forest color), **no divider** under the nav on this screen (the editorial title acts as the visual anchor).
- Greeting block:
  - Small italic kicker "Good evening," in Instrument Serif italic 18pt, ink2 color.
  - Big serif name + period: `Saif.` at 56pt, line-height 1, letter-spacing `-0.02em`, ink color.
  - Date eyebrow: "FRI · MAY 15 · 2026" in JetBrains Mono 11.5pt, uppercase, letter-spacing 1.5, ink3.
- **Recently cooked**: horizontal scroll of 148pt-wide cards. Card = 148×148 monogram tile + dish title (15pt 600) + relative-time eyebrow (mono 10.5pt uppercase, ink3).
- **Most cooked**: 2-column grid. Each card is a unit with a 90pt monogram band on top + a 10×12 padding text block. Title (13.5pt 600) + `×N` (Instrument Serif italic 18pt, forest) + "COOKED" (mono 10pt).
- **Upcoming plans**: section label with "View all" link on the right (forest 12.5pt). One plan card: round sage icon-bubble + title + "YESTERDAY · 2 DISHES" eyebrow + chevron.

### 2. Plans list (`ScreenPlans`)

- Nav: title "Plans", gear right, **divider on**.
- Title block: serif "Plans" at 44pt + subtitle "Occasion menus, dinners, weeknight cooks." (14pt ink2).
- Plan card identical to the Home upcoming-plans card.
- Below: empty-state hint, italic serif "One plan so far." + body explanation (max-width 260pt, centered).
- **Floating FAB**: 56pt circle, forest bg, white plus, 22pt right padding from edge, anchored 116pt from bottom (sits above the tab bar). Use `forestText` color for the icon — in dark mode the FAB becomes the lighter sage-green so the icon needs to be dark, not white.

### 3. Plan detail (`ScreenPlanDetail`)

- Nav: title "Eid Al Adha", left chevron-back, right pencil-edit.
- Hero: "Eid Al Adha" serif 46pt + date eyebrow "THU · MAY 14 · 2026" mono 11pt + sage chip with gauge icon: "2 dishes · medium".
- DISHES section label.
- Two dish rows — each is a card (44pt monogram + dish title + pencil icon right).
- Big sage-forest CTA: `Add dish to plan` with leading plus-circle icon. Full width, pill radius 99, padding 16, font 15.5 weight 600.

### 4. Edit plan (`ScreenEditPlan`)

- Nav: "Edit plan" centered. Left text-button "Cancel" (forest 15 500). Right text-button "Save" (forest 15 600).
- Form fields: "Plan name" (text input, value `Eid Al Adha`), "Planned date" (read-only-looking input with calendar icon, value in mono font), "Notes" (multi-line, italic serif placeholder).
- Bottom danger row: rose/pink soft-bg card, "Delete plan" + "Dishes stay in your library" caption, chevron right. Use `danger` for text, `dangerSoft` for bg.

### 5. Add-dish bottom sheet (over Plan detail)

- Plan detail visible behind a 32%-opacity scrim (warm-dark in light mode, ~55% black in dark mode).
- Sheet sits flush to bottom, radius 22 top corners, `paper` bg.
- 38×4 ink4 handle, centered, 14pt below top.
- "Add a dish" serif 28pt.
- Search input: `cream`/`creamSoft` bg, sage border, search-glass icon, placeholder "Search your meals…".
- List of dishes — each row: 36pt monogram + name + circular outline-plus button (32pt, forest border 1.5).

### 6. Add hub (`ScreenAdd`)

- Nav: "Add", gear right, **no divider**.
- Title block: "Add a meal" serif 44pt + subtitle paragraph 14pt ink2 explaining capture methods.
- CAPTURE section label.
- **Primary action card**: full-width row card, forest bg, light text. Icon-bubble at 12% white, title 15.5pt 600, sub 12.5pt 75%-opacity. Chevron right.
- Two **secondary cards**: `surface` bg, sage icon-bubble, ink text. Same row layout.
  - "Capture with AI" / "Photo, voice note, or pasted text."
  - "Save a link" / "YouTube, TikTok, Pinterest, or a recipe URL."
- PLANS section label.
- One row card: "Plan an occasion menu" / "Eid, Diwali, dinner party." Same secondary-card style.

### 7. Log a meal (`ScreenLogMeal`)

Form layout. Fields stacked with 18pt gaps:

1. **Meal name** — text input, placeholder "What did you cook?"
2. **When** — pseudo-input showing `Today` in mono font, calendar icon right
3. **Photo** — 180pt dashed-border drop zone, `creamSoft` bg with diagonal `repeating-linear-gradient` stripes at 14pt spacing, opacity 0.6. Image icon + "Add a photo" (15pt 600) + "Camera or library" (mono 10.5 uppercase).
4. **Effort** — 4-segment pill control, "Quick / Easy / Medium / High". Active segment is forest bg with `forestText`. Inactive is transparent with ink2 text.
5. **Notes** — text area, 90pt min-height, italic serif placeholder "Doubled the garlic. Used chicken stock instead of water…". Caption below in mono "What worked, what to change next time."
6. **Source URL** — text input, mono font, placeholder `https://youtube.com/…`

### 8. Capture with AI (`ScreenCaptureAI`)

- Nav: "Capture with AI", left chevron, right gear.
- Mode toggle: 3 equal-flex pill tabs — "Photo" (active, forest bg), "Text", "Voice". Each has a small leading icon. 11pt padding.
- Title block: "Capture a recipe." serif 36pt + 3-line subtitle paragraph.
- **Hero CTA card**: forest bg, light text, 18pt radius, 32pt top padding. White-translucent 60pt circle with camera icon. "Add a photo" serif 28pt. "CAMERA · LIBRARY" mono 11 eyebrow.
  - Faint dotted overlay (8% white in light, 12% dark-on-light in dark) at 16×16 pattern.
- Tips card: `surface`. Eyebrow "FOR SHARPER RESULTS". 3 rows, each: lightbulb icon (forest) + body 13.5pt.

### 9. Library (`ScreenLibrary`)

- Nav: "Library", gear right, divider.
- Title block: "Library" 44pt serif + "Every meal cooked in your kitchen." (14pt ink2).
- Search bar: pill radius, white bg, sage border, search-glass icon, placeholder "Search by name…".
- Filter chips row (horizontal scroll, bleed edges to screen): "All · 5" (active, sage-bg), "Recent", "Most cooked", "Quick", "High effort". Inactive chips have transparent bg + thin border.
- Meal list: card rows, 52pt monogram + dish title (14.5pt 600) + meta eyebrow "6 DAYS AGO · MEDIUM" (mono 10.5 uppercase) + chevron right.

### 10. Settings (`ScreenSettings`)

- Nav: "Settings", gear right, divider.
- Title "Settings" 44pt serif.
- 4 sections, each with eyebrow label + grouped card:
  - **ACCOUNT**: Name (`alex.rivers`), Email (`alex@example.com`). Values right-aligned, mono 12.5pt ink2.
  - **PLAN**: "Current plan" + ghost chip "Free". "See Plus features" with external-link icon (forest).
  - **KITCHEN**: "Members + invitations" + sub "Just you · 1 pending invite" + chevron.
  - **ADVANCED**: "Manage account on web" + sub "Edit profile, delete account, subscription." + external icon.
- Each row inside a grouped card: 14pt vertical padding, 16pt horizontal. Rows after the first get a `borderSoft` top divider.
- Footer: "EEATLY · V2.1" mono 10.5pt uppercase ink3, centered.

### 11. Kitchen members (`ScreenKitchen`)

- Nav: "Kitchen", left chevron, right gear.
- Title block: italic kicker "The" + serif "rivers kitchen." at 44pt + "JUST YOU FOR NOW" mono eyebrow.
- "Invite someone" forest pill button with person-plus icon (inline, not full-width).
- MEMBERS section: one card with avatar (wheat bg, italic serif `M.` 24pt) + name + (you) + email (mono small) + sage "Owner" chip + "JOINED MAY 13 · 2026" eyebrow.
- PENDING INVITATIONS section: one card with email + "SENT MAY 13 · EXPIRES MAY 20" eyebrow + "Cancel" pill button (dangerSoft bg, danger text).
- Bottom centered: "Leave kitchen" pill button (transparent bg, danger border + text). Caption below explaining "Your recipes stay credited to you…"

## Interactions & behavior

Most interactions are taps with the platform's standard navigation. Specifics worth flagging:

- **Tab bar** is persistent across Home/Add/Library. Active tab has a sage pill behind the icon (28×40 capsule, sageBg) and forest-colored fill icon; label switches to 600 weight + forest color. Inactive uses outline icon + ink3.
- **Bottom sheet** (Add a dish): standard iOS interruptive sheet, drag handle is visual only — sheet height fits its content, dismisses on backdrop tap or downward drag. Scrim is `rgba(20,20,15,0.32)` (light) / `rgba(0,0,0,0.55)` (dark).
- **FAB on Plans**: opens the "New plan" flow (not designed yet — out of scope).
- **CTA pressed states**: darken by ~6% (mix with ink). Or use system pressure-feedback if SwiftUI.
- **Search input** placeholder shows ink3 color; on focus, the bar gets a forest border (1.5px).
- **Effort segmented control**: tapping a segment animates the active pill across with a 180ms ease-out.
- **Theme switching**: prefer following the system appearance setting. Tokens above swap atomically — no per-component overrides should be needed.
- **List swipe-to-delete** on Library rows is expected (not designed; use platform default) — destructive action should use `danger` color.

## Copy

All copy is final. Notable lines:

- Empty greeting morning/afternoon/evening logic: use the user's local time. First name only (or first 8 chars before a dot if username contains a dot). Period after the name is intentional.
- Plans empty hint: "One plan so far." + "Use plans for menus tied to a date — Eid, Diwali, a dinner party."
- AI capture sub: "Snap a recipe card, cookbook page, or finished dish. We'll lift the name, ingredients, and steps — then you review before saving."
- Leave-kitchen caption: "Your recipes stay credited to you. You'll land in a fresh personal kitchen."

## Files in this handoff

- `eeatly Mobile Redesign.html` — top-level prototype file that wires everything together; orchestrates the design canvas with all 21 artboards
- `eeatly-shell.jsx` — shared design tokens (`E_LIGHT` / `E_DARK`), icon set (`I`), theme context (`useT`), and primitive components (`Phone`, `NavBar`, `TabBar`, `Card`, `Chip`, `IconBubble`, `MealTile`, `Content`)
- `eeatly-screens.jsx` — all 11 screen components (`ScreenHome`, `ScreenPlans`, `ScreenPlanDetail`, `ScreenEditPlan`, `AddDishSheet`, `ScreenAdd`, `ScreenLogMeal`, `ScreenCaptureAI`, `ScreenLibrary`, `ScreenSettings`, `ScreenKitchen`). Each screen takes a `dark` prop.
- `ios-frame.jsx` — iPhone device frame chrome (status bar + dynamic island + home indicator). Not needed in the real app; it's just a presentation wrapper. Strip when implementing.
- `design-canvas.jsx` — pan/zoom canvas that arranges the artboards. Not needed in the real app.
- `screenshots/` — PNG renders of all 22 screens (11 light + 11 dark), numbered in flow order. Reference images for quick visual lookups; the source of truth is the HTML prototype.

## Notes for implementation

- The HTML uses Google Fonts (`Instrument Serif`, `Geist`, `JetBrains Mono`). In SwiftUI, register the fonts as resources and reference by PostScript name. In React Native, use `expo-font` or platform font registration.
- The design canvas + iOS frame in the HTML are presentation chrome — **do not port them**. Build directly into the native nav stack.
- The "monogram tile" component is the most important piece to get right — it's the visual signature. A single shared `MealTile(name)` view that renders the letter + dotted bg + hairline frame on a hashed-palette card is the right factoring. Photo uploads replace the tile with an image at the same dimensions/radius.
- All hardcoded user data in the prototype (`alex.rivers`, `Eid Al Adha`, `Chicken Biryani`, etc.) is illustrative — wire to real models.
- The prototype doesn't include any onboarding, sign-in, or empty-empty states (zero meals, zero plans). Match the existing app's patterns for those.
