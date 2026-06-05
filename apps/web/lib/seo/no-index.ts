import type { Metadata } from "next";

/**
 * Shared `robots: noindex, nofollow` metadata for every private surface (the
 * authenticated app, admin, auth, onboarding, token-gated invite/connect/share
 * pages). Exported as a route/layout `metadata` so it cascades to children, and
 * mirrored by an `X-Robots-Tag` header in the proxy and a robots.txt disallow
 * for defence in depth.
 */
export const noIndexMetadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false }
  }
};
