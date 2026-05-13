import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // typedRoutes intentionally disabled — it regenerates route type metadata
  // on every HMR pass, contributing to Turbopack's async-hooks Map pressure
  // in dev. Existing `as Route` casts still typecheck cleanly without it.
  typedRoutes: false,
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
          }
        ]
      }
    ];
  }
};

export default nextConfig;
