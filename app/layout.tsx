import type { Metadata, Viewport } from "next";
import { getPublicEnv } from "@/lib/env/public";
import "./globals.css";

const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "CookLoop",
    template: "%s | CookLoop"
  },
  description: "A personal cooking memory app for remembering what to cook next.",
  applicationName: "CookLoop",
  openGraph: {
    title: "CookLoop",
    description: "Remember meals worth making again.",
    url: appUrl,
    siteName: "CookLoop",
    type: "website",
    images: [
      {
        url: "/og.svg",
        width: 1200,
        height: 630,
        alt: "CookLoop dashboard preview"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "CookLoop",
    description: "Remember meals worth making again.",
    images: ["/og.svg"]
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.svg"
  },
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  themeColor: "#2f6f58"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
