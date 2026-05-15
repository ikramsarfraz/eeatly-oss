"use client";

import * as React from "react";

export type Breakpoint = "mobile" | "tablet" | "desktop";

// Maps to Tailwind's responsive thresholds in app/globals.css.
// mobile  <  md (820)   — sheet nav, bottom tab bar
// tablet  ≥ md, < lg    — icon-rail nav
// desktop ≥ lg (1080)   — full sidebar
const TABLET_MIN = 820;
const DESKTOP_MIN = 1080;

function read(width: number): Breakpoint {
  if (width >= DESKTOP_MIN) return "desktop";
  if (width >= TABLET_MIN) return "tablet";
  return "mobile";
}

/**
 * Resolves the active breakpoint as a discriminated string for components
 * that want to choose a render path (vs. style different DOM with media
 * queries). SSR-safe: defaults to `"desktop"` until the first effect tick.
 *
 * Used by `/history` to pick between cards / rows / table; future surfaces
 * with similarly different information densities can reuse it.
 */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = React.useState<Breakpoint>("desktop");

  React.useEffect(() => {
    const sync = () => setBp(read(window.innerWidth));
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return bp;
}
