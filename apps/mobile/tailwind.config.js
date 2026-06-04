/** @type {import('tailwindcss').Config} */
// Round 19 — eeatly mobile design tokens, dark-mode aware.
//
// Color philosophy: no pure white, no pure black, no jewel tones. Every
// surface sits on a warm cream ground in light mode; in dark mode the
// cream rotates to a warm near-black with the same forest/sage/wheat
// accent system retuned so contrast survives the inversion.
//
// Dark mode strategy: NativeWind v4 emits the `dark:` variant when
// `darkMode: 'media'` and the system appearance is dark. Each semantic
// token has a sibling `-dark` value so callers can write
// `bg-cream dark:bg-cream-dark`. Inline style consumers (where
// className isn't enough — e.g. dynamic `style={{ color: x }}`) read
// from `lib/design/use-theme-colors.ts`, which mirrors this palette
// off `useColorScheme()`.
//
// `content` is the NativeWind v4 glob — every file that uses className
// must match, otherwise Metro's nativewind transform skips it and the
// styles silently disappear at runtime.
module.exports = {
  darkMode: "media",
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Cream / paper grounds. `cream` is the app background, `paper`
        // is the warmer sheet/surface variant, `surface` is the elevated
        // card/input bg, `cream-soft` is a slightly darker neutral used
        // for dashed photo zones and other "subtle alt" backgrounds.
        cream: "#F5EFE2",
        "cream-dark": "#15140F",
        "cream-soft": "#EFE7D6",
        "cream-soft-dark": "#1C1A14",
        paper: "#FBF6EA",
        "paper-dark": "#1A1812",
        surface: "#FFFFFF",
        "surface-dark": "#1F1D17",

        // Ink / text scale. `ink` is the primary text; ink-2/ink-3 step
        // down for secondary and tertiary. ink-4 is reserved for hairline
        // dividers and strikethrough decoration.
        ink: "#1A1F1A",
        "ink-dark": "#F0E9D9",
        "ink-2": "#5F665B",
        "ink-2-dark": "#A8A28F",
        "ink-3": "#9C9787",
        "ink-3-dark": "#736F5E",
        "ink-4": "#C7C1B0",
        "ink-4-dark": "#3A382E",

        // Forest greens. `forest` is the primary CTA bg + active state
        // color in light mode; in dark mode the brand inverts to a
        // lighter sage-green so the CTA reads against the warm-black
        // background. `forest-text` is what's drawn ON the forest bg.
        forest: "#2E5739",
        "forest-dark": "#88B894",
        "forest-deep": "#1F3D29",
        "forest-deep-dark": "#6FA37D",
        "forest-soft": "#3C6B47",
        "forest-soft-dark": "#A1CBA9",
        "forest-text": "#F5EFE2",
        "forest-text-dark": "#10180F",

        // Sage tints. `sage-bg` is the active tab pill, icon-bubble bg,
        // and sage chip — the "softly highlighted" surface that signals
        // selection without competing with the primary CTA.
        sage: "#D4DCC5",
        "sage-dark": "#445040",
        "sage-deep": "#BFCBB1",
        "sage-deep-dark": "#576550",
        "sage-bg": "#E3E8D5",
        "sage-bg-dark": "#2A3022",

        // Accent palettes used in a few places.
        terra: "#C66B47",
        "terra-dark": "#D88865",
        wheat: "#D9C68C",
        "wheat-dark": "#C9B176",

        // Borders. `border` is the standard card/input edge; border-soft
        // is the inner divider between grouped-card rows.
        border: "#E6DCC4",
        "border-dark": "#2D2B22",
        "border-soft": "#EEE5D0",
        "border-soft-dark": "#26241D",

        // Destructive treatments. danger is the text/icon color, danger-soft
        // is the bg of the destructive button / row.
        danger: "#A8413A",
        "danger-dark": "#D88078",
        "danger-soft": "#F0DBD8",
        "danger-soft-dark": "#3A211E"
      },
      borderRadius: {
        // Tight tiles → tighter corners; generous cards → 14; hero cards
        // and bottom sheets → 18-22; pill (CTAs, chips, tabs) → 9999.
        xs: "6px",
        sm: "8px",
        md: "12px",
        lg: "14px",
        card: "14px",
        xl: "18px",
        "2xl": "22px",
        pill: "9999px"
      },
      fontFamily: {
        // Three families: Instrument Serif for editorial display, Geist
        // for body/UI, JetBrains Mono for date eyebrows + metadata. The
        // PostScript names below match what `expo-font` registers when
        // loaded with the `@expo-google-fonts/*` packages — RN can't
        // synthesize weights from a single family on iOS, so each weight
        // is its own family token.
        display: ["InstrumentSerif_400Regular", "Georgia", "serif"],
        "display-italic": [
          "InstrumentSerif_400Regular_Italic",
          "Georgia",
          "serif"
        ],
        body: ["Geist_400Regular", "System"],
        "body-medium": ["Geist_500Medium", "System"],
        "body-semibold": ["Geist_600SemiBold", "System"],
        "body-bold": ["Geist_700Bold", "System"],
        mono: ["JetBrainsMono_400Regular", "Menlo", "monospace"],
        "mono-medium": ["JetBrainsMono_500Medium", "Menlo", "monospace"],
        "mono-semibold": ["JetBrainsMono_600SemiBold", "Menlo", "monospace"]
      },
      fontSize: {
        // Type scale lifted from the handoff. Each entry pairs size +
        // line-height. Weight is applied through the font-family choice
        // (Geist family is split into weight-specific PostScript names
        // since RN can't reliably switch weights on a single family).
        "display-xl": ["56px", { lineHeight: "56px" }],
        "display-lg": ["46px", { lineHeight: "48px" }],
        "display-md": ["44px", { lineHeight: "46px" }],
        "display-sm": ["36px", { lineHeight: "38px" }],
        "display-xs": ["28px", { lineHeight: "32px" }],
        "kicker": ["18px", { lineHeight: "22px" }],
        "title-lg": ["18px", { lineHeight: "24px" }],
        "title-md": ["16px", { lineHeight: "20px" }],
        "body-lg": ["15px", { lineHeight: "20px" }],
        "body-md": ["14px", { lineHeight: "20px" }],
        "body-sm": ["13.5px", { lineHeight: "18px" }],
        "chip": ["12.5px", { lineHeight: "16px" }],
        "label": ["11.5px", { lineHeight: "14px" }],
        "eyebrow": ["10.5px", { lineHeight: "14px" }],
        "eyebrow-xs": ["10px", { lineHeight: "12px" }],

        // Compat aliases for screens not yet migrated. New code should
        // prefer the named scale above.
        display: ["44px", { lineHeight: "46px" }],
        "heading-1": ["28px", { lineHeight: "34px" }],
        "heading-2": ["22px", { lineHeight: "28px" }],
        "heading-3": ["18px", { lineHeight: "24px" }],
        body: ["15px", { lineHeight: "22px" }],
        caption: ["14px", { lineHeight: "20px" }],
        "caption-strong": ["13.5px", { lineHeight: "18px" }],
        small: ["12px", { lineHeight: "16px" }]
      },
      letterSpacing: {
        tightest: "-0.4px",
        tighter: "-0.15px",
        tight: "-0.1px",
        eyebrow: "1.4px",
        eyebrowLg: "1.5px"
      },
      lineHeight: {
        "0.98": "0.98",
        "1.05": "1.05"
      }
    }
  },
  plugins: []
};
