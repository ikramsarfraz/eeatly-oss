import type { NextConfig } from "next";
import nextBundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = nextBundleAnalyzer({
  enabled: process.env.ANALYZE === "true"
});

// Conservative Content-Security-Policy.
// Intentionally narrow: only adds directives that don't risk breaking React's
// inline-hydration scripts or third-party assets. To tighten further (e.g.
// script-src with nonces, strict img-src), measure first — CSP regressions
// are subtle and CSP-only docs in production are worth shipping incrementally.
//
// Round 16 — added `frame-src` to whitelist the three embed hosts users save
// recipes from. Without these, the YouTube/TikTok/Pinterest iframes would be
// blocked. Limit to the canonical hosts (`youtube-nocookie.com` is the
// privacy-preserving variant we actually embed). The TikTok + Pinterest
// embed widgets load JS from `tiktok.com` and `assets.pinterest.com`
// respectively — we don't set an explicit `script-src` directive here
// because adding one without a nonce would break React's inline-hydration
// scripts. The browser's default behaviour (no script-src → no allowlist
// enforcement) covers it.
const contentSecurityPolicy = [
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-src 'self' https://www.youtube-nocookie.com https://www.tiktok.com https://www.pinterest.com https://assets.pinterest.com"
].join("; ");

const nextConfig: NextConfig = {
  typedRoutes: true,
  // Round 12: workspace packages live as .ts source (not pre-built .d.ts +
  // .js). Next needs to compile them through SWC alongside app code.
  transpilePackages: ["@eeatly/api", "@eeatly/shared"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff"
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin"
          },
          {
            key: "X-Frame-Options",
            value: "DENY"
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()"
          },
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy
          }
        ]
      },
      // Round 15.5 Task 3 — Universal Links + App Links manifests. The
      // iOS AASA file has no extension, so without an explicit
      // Content-Type Next.js would serve it as application/octet-stream
      // and Apple's CDN would refuse to ingest it. The Android
      // assetlinks.json is JSON-by-extension but we set the type
      // explicitly anyway for parity.
      //
      // `X-Content-Type-Options: nosniff` blocks heuristic content
      // sniffing, so the explicit Content-Type here is the only signal
      // Apple's swcd / Google's PackageManager will see.
      {
        source: "/.well-known/apple-app-site-association",
        headers: [
          {
            key: "Content-Type",
            value: "application/json"
          }
        ]
      },
      {
        source: "/.well-known/assetlinks.json",
        headers: [
          {
            key: "Content-Type",
            value: "application/json"
          }
        ]
      }
    ];
  }
};

export default withBundleAnalyzer(nextConfig);
