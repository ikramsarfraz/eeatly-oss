import type { MetadataRoute } from "next";

/**
 * Sitemap — public, indexable pages only. The product surfaces are auth-gated
 * and intentionally excluded.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  // Canonical `www` host (the apex 308-redirects here). A sitemap must always
  // advertise the production canonical, never a preview or apex host. R32.6.
  const base = "https://www.eeatly.com";
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/help`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 }
  ];
}
