import type { MetadataRoute } from "next";

/**
 * robots.txt. Only the public marketing surfaces are crawlable; the whole
 * authenticated product, admin, and auth flow are disallowed (and additionally
 * carry `noindex` metadata + an `X-Robots-Tag` header).
 *
 * `/share/*` is intentionally NOT disallowed: those token pages must be
 * fetchable by social-card scrapers (WhatsApp, Twitterbot, etc.) so shared
 * links render a preview card. They're kept out of search indexes by their
 * own `robots: { index: false }` metadata plus the proxy's `X-Robots-Tag`
 * header, not by a crawl block here.
 */
export default function robots(): MetadataRoute.Robots {
  // Canonical `www` host (the apex 308-redirects here). R32.6.
  const base = "https://www.eeatly.com";
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/privacy", "/help"],
        disallow: [
          "/admin",
          "/api",
          "/home",
          "/library",
          "/plans",
          "/meal",
          "/add",
          "/people",
          "/kitchen",
          "/settings",
          "/ideas",
          "/onboarding",
          "/sign-in",
          "/sign-up",
          "/invite",
          "/connect"
        ]
      }
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base
  };
}
