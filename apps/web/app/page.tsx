import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getServerEnv, isLaunchFreeAccess } from "@/lib/env/server";
import { getTierDisplayPrices } from "@/services/pricing-display";
import MarketingPage from "./marketing-page";

const META_DESCRIPTION =
  "Save the family recipes that matter, from voice notes, WhatsApp photos, recipe links, however they reach you. Shared kitchens across continents.";

export const metadata: Metadata = {
  title: "eeatly: One kitchen for your whole family",
  description: META_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: "eeatly: One kitchen for your whole family",
    description: META_DESCRIPTION,
    type: "website",
    siteName: "eeatly"
  },
  twitter: {
    card: "summary_large_image",
    title: "eeatly: One kitchen for your whole family",
    description: META_DESCRIPTION
  }
};

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) {
    redirect("/home");
  }

  const env = getServerEnv();
  const prices = await getTierDisplayPrices();

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
      <MarketingPage prices={prices} launchFreeAccess={isLaunchFreeAccess(env)} />
    </>
  );
}
