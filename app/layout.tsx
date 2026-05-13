import type { Metadata, Viewport } from "next";
import { getPublicEnv } from "@/lib/env/public";
import "./globals.css";

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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
