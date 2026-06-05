import type { MetadataRoute } from "next";
import { getPublicEnv } from "@/lib/env/public";

/**
 * robots.txt. Only the public marketing surfaces are crawlable; the whole
 * authenticated product, admin, auth flow, and token-gated pages are disallowed
 * (and additionally carry `noindex` metadata + an `X-Robots-Tag` header).
 */
export default function robots(): MetadataRoute.Robots {
  const base = (getPublicEnv().NEXT_PUBLIC_APP_URL ?? "https://eeatly.com").replace(/\/$/, "");
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
          "/connect",
          "/share"
        ]
      }
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base
  };
}
