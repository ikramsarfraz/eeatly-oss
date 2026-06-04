# eeatly mobile redesign — design handoffs

This folder is **design reference only**. The JSX files in each
sub-bundle are HTML prototypes — not production source. The
corresponding implementation lives under `apps/mobile/` for the UI
and `apps/web/server/trpc/routers/` + `apps/web/services/` for the
persistence layer.

When picking up a UI implementation round (R19+), read the bundle's
`README.md` for layout specs + token tables, then translate to the
shared mobile primitives in `apps/mobile/components/ui/`.

## Bundles, in chronological order

| Folder | Round | What's covered |
|---|---|---|
| `mobile-redesign-v1/` | R17 | Original 11-screen redesign — home, plans, add, library, settings, kitchen, log/capture screens. Includes light + dark variants of every artboard. |
| `recipe-detail/` | R17 follow-up | First recipe-detail pass — hero tile, two-line title, ingredient checklist, recipe steps, log-a-cook CTA. |
| `recipe-detail-v2/` | R17 follow-up | Recipe-detail with structured ingredients (qty + prep note), step bodies + time eyebrows, "FOLLOW IN ORDER" connector. |
| `recipe-detail-v3/` | R18 spec | Adds the Refine recipe flow — AI-prompted editing surface (Text/Voice/Photo) + Review changes diff screen. This is the surface R18's backend (`apps/web/services/refine.ts`, `routers/refine.ts`) targets. |

## Conventions

- **Don't ship the iOS bezel.** The frame in each bundle's
  `_preview-*.html` and `ios-frame.jsx` is presentation-only.
- **Reuse the shared kit.** `Card`, `Chip`, `SectionLabel`,
  `IconBubble`, `NavBar`, `TabBar`, `MealTile` are documented in the
  bundles' `eeatly-shell.jsx`. Mobile equivalents live under
  `apps/mobile/components/ui/`.
- **Tokens.** The `E_LIGHT` / `E_DARK` palette in each bundle matches
  `apps/mobile/lib/design/tokens.ts` + `apps/mobile/tailwind.config.js`.
  Update either side and the other must follow.
- **Fonts.** Instrument Serif (display), Geist (body/UI), JetBrains
  Mono (metadata). Loaded via `@expo-google-fonts/*` in
  `apps/mobile/lib/design/use-app-fonts.ts`.

## Not in this folder

- The `eeatly Mobile Redesign.html` top-level prototype in
  `mobile-redesign-v1/` orchestrates the v1 canvas of all 21 artboards.
  Open it in a browser to pan/zoom across screens; double-click an
  artboard to fullscreen it.
- Screenshots live in each bundle's `screenshots/` or as siblings
  alongside the JSX files.
