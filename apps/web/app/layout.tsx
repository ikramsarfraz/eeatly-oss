import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono, Geist } from "next/font/google";
import { AppThemeProvider } from "@/components/providers/app-theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ToastProvider } from "@/components/providers/toast-provider";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import "./globals.css";

// Self-hosted via next/font — no Google Fonts CDN dependency, font files are
// inlined into the HTML bundle, and the CSS variables below are consumed
// from globals.css.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-loaded",
  display: "swap"
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-serif-loaded",
  display: "swap"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-loaded",
  display: "swap"
});

// Geist — body/UI font for the brand + marketing surfaces (design handoff).
// Scoped to the marketing page via the `.mkt` root; the authed app keeps Inter.
const geist = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-geist",
  display: "swap"
});

// Canonical production origin. The apex `eeatly.com` 308-redirects to this
// `www` host, so every absolute URL Next derives from `metadataBase` (og:image,
// twitter:image, and the per-page relative canonicals) must already be `www` to
// avoid sending crawlers + social scrapers through that redirect hop. Fixed, not
// env-derived: the canonical host is the same regardless of which host (preview,
// apex, www) actually served the request. R32.6.
const canonicalOrigin = "https://www.eeatly.com";

export const metadata: Metadata = {
  metadataBase: new URL(canonicalOrigin),
  title: {
    default: "eeatly",
    template: "%s | eeatly"
  },
  description: "eeatly helps you remember meals you love and decide what to cook next.",
  applicationName: "eeatly",
  openGraph: {
    title: "eeatly",
    description: "Remember meals you love. Decide what to cook next.",
    url: canonicalOrigin,
    siteName: "eeatly",
    type: "website"
    // `og:image` is injected by the file-based `app/opengraph-image.tsx`
    // route (1200x630 PNG). No `images` array here: a manual entry would
    // emit a second `og:image` tag, and the old `/og.svg` was never
    // rendered by social scrapers (they don't accept SVG), which is why
    // shared links showed a blank card.
  },
  twitter: {
    card: "summary_large_image",
    title: "eeatly",
    description: "Remember meals you love. Decide what to cook next."
    // `twitter:image` injected by `app/twitter-image.tsx`.
  }
  // Browser-tab favicon, modern icon, and apple-touch-icon come from the
  // `app/` file conventions (`favicon.ico`, `icon.svg`, `apple-icon.png`);
  // the PWA manifest from `app/manifest.ts`. Next auto-injects the link tags
  // for all of these, so no explicit `icons`/`manifest` metadata is needed.
};

export const viewport: Viewport = {
  // Brand forest. Matches `theme_color` in `app/manifest.ts`.
  themeColor: "#2E5739",
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      // R31 — `suppressHydrationWarning` is the standard `next-themes`
      // requirement: the provider injects an inline script that sets
      // the `class` attribute before React hydrates, which would
      // otherwise trip React's hydration mismatch warning.
      suppressHydrationWarning
      className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} ${geist.variable}`}
    >
      <body>
        {/* Keyboard accessibility: jump straight to content without
            tab-walking the sidebar/topbar on every page. The target is
            the <main> element rendered by each layout/page. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-sm focus:text-background focus:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        {/* Theme provider (class strategy on <html>). Defaults to LIGHT, no OS
            tracking; the marketing / public / auth "front door" routes are
            forced to light regardless of the saved choice. See
            `AppThemeProvider`. */}
        <AppThemeProvider>
          <QueryProvider>
            <PostHogProvider>
              <ToastProvider>{children}</ToastProvider>
            </PostHogProvider>
          </QueryProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
