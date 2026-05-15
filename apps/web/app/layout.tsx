import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { getPublicEnv } from "@/lib/env/public";
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

// NEXT_PUBLIC_APP_URL must be set to the production origin in Vercel env vars.
// The localhost fallback is only for local development.
const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "eeatly",
    template: "%s | eeatly"
  },
  description: "eeatly helps you remember meals you love and decide what to cook next.",
  applicationName: "eeatly",
  openGraph: {
    title: "eeatly",
    description: "Remember meals you love. Decide what to cook next.",
    url: appUrl,
    siteName: "eeatly",
    type: "website",
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: "eeatly dashboard preview"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "eeatly",
    description: "Remember meals you love. Decide what to cook next.",
    images: ["/og.svg"]
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.svg"
  },
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  themeColor: "#2f6f58",
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
      className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
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
        {children}
      </body>
    </html>
  );
}
