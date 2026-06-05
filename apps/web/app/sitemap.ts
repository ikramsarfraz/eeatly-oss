import type { MetadataRoute } from "next";
import { getPublicEnv } from "@/lib/env/public";

/**
 * Sitemap — public, indexable pages only. The product surfaces are auth-gated
 * and intentionally excluded.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (getPublicEnv().NEXT_PUBLIC_APP_URL ?? "https://eeatly.com").replace(/\/$/, "");
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/help`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 }
  ];
}
