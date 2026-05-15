/** @type {import('tailwindcss').Config} */
// Round 17 — eeatly mobile design tokens.
//
// Token palette mirrors the web landing page so the mobile app reads
// as the same product. Colors are referenced by semantic name (not raw
// hex) everywhere downstream, which makes a future dark-mode pass a
// configuration change rather than a search-and-replace.
//
// `content` is the NativeWind v4 glob — must include every file that
// might use `className`. Babel's nativewind preset only compiles what
// matches these globs, so a missed entry means missing styles at
// runtime.
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: {
          DEFAULT: "#FBF8F1",
          elevated: "#FFFFFF",
          muted: "#F3EFE3"
        },
        foreground: {
          DEFAULT: "#1A1F1B",
          muted: "#6B7068",
          subtle: "#9A968A"
        },
        primary: {
          DEFAULT: "#2C5F3F",
          foreground: "#FBF8F1",
          muted: "#C4D4C8"
        },
        accent: {
          DEFAULT: "#C9A14C",
          foreground: "#1A1F1B"
        },
        destructive: {
          DEFAULT: "#A03830",
          foreground: "#FBF8F1"
        },
        border: {
          DEFAULT: "#E5E0D5",
          strong: "#B8B0A0"
        }
      },
      borderRadius: {
        sm: "8px",
        md: "14px",
        lg: "20px",
        pill: "9999px"
      },
      fontSize: {
        // Each entry pairs size + line-height. Weight is applied via
        // font-weight utility (font-normal / font-semibold / font-bold).
        display: ["32px", { lineHeight: "38px" }],
        "heading-1": ["28px", { lineHeight: "34px" }],
        "heading-2": ["22px", { lineHeight: "28px" }],
        "heading-3": ["18px", { lineHeight: "24px" }],
        body: ["16px", { lineHeight: "22px" }],
        caption: ["14px", { lineHeight: "20px" }],
        small: ["12px", { lineHeight: "16px" }]
      }
    }
  },
  plugins: []
};
