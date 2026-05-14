import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env/server";
import MarketingPage from "./marketing-page";

const META_DESCRIPTION =
  "Save the family recipes that matter — from voice notes, WhatsApp photos, YouTube videos, however they reach you. Shared kitchens across continents.";

export const metadata: Metadata = {
  title: "eeatly — One kitchen for your whole family",
  description: META_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "eeatly — One kitchen for your whole family",
    description: META_DESCRIPTION,
    type: "website",
    siteName: "eeatly"
  },
  twitter: {
    card: "summary_large_image",
    title: "eeatly — One kitchen for your whole family",
    description: META_DESCRIPTION
  }
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  const env = getServerEnv();
  const monthlyPriceDisplay = env.STRIPE_PRICE_MONTHLY_DISPLAY ?? null;

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "eeatly",
    url: env.NEXT_PUBLIC_APP_URL,
    description: META_DESCRIPTION
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <MarketingPage monthlyPriceDisplay={monthlyPriceDisplay} />
    </>
  );
}
