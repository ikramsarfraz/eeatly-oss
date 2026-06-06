import type { MetadataRoute } from "next";

/**
 * PWA web manifest (served at `/manifest.webmanifest`). Replaces the former
 * static `public/manifest.webmanifest` (a static file and this route cannot
 * coexist at the same path). Next auto-injects the `<link rel="manifest">`
 * tag, so no `metadata.manifest` entry is needed in `layout.tsx`.
 *
 * The 192/512 install icons live in `public/` (referenced by absolute path
 * here); the browser-tab + apple-touch icons come from the `app/` file
 * conventions (`favicon.ico`, `icon.png`, `apple-icon.png`).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "eeatly",
    short_name: "eeatly",
    description: "A shared kitchen for families who cook from far apart.",
    start_url: "/",
    display: "standalone",
    background_color: "#EFE7D6",
    theme_color: "#2E5739",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  };
}
