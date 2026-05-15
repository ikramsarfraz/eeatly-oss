/**
 * Round 12 — re-export of the `AppRouter` type so mobile + any external
 * client can `import type { AppRouter } from "@eeatly/api"` and get
 * full inference across the entire procedure surface.
 *
 * This is a TYPE-ONLY re-export. The relative path crosses a package
 * boundary which is unusual, but TypeScript strips the import at
 * compile time so no runtime coupling lands in any client bundle.
 * Metro / Webpack / esbuild see nothing at runtime; only `tsc` /
 * editor tooling traverse this path.
 *
 * If `apps/web` ever stops being the canonical home for the
 * AppRouter (e.g. router definition moves to its own package),
 * update this re-export. The wire contract stays the same.
 */
export type { AppRouter } from "../../../apps/web/server/trpc/app-router";
