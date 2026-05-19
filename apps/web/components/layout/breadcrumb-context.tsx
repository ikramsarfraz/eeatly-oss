"use client";

import * as React from "react";

/**
 * Round 30 — dynamic breadcrumb override.
 *
 * R26 ships a static `getCrumbs(pathname)` map for the TopBar trail.
 * Routes with dynamic segments (Recipe Detail, Refine, Review,
 * Plan Detail, etc.) need a runtime hook to swap the placeholder
 * label ("Recipe" / "Plan") for the actual data (meal name, plan
 * name). This context is that hook.
 *
 * Override semantics — single string with optional target label:
 *   - `useSetBreadcrumb(label)` replaces the LAST crumb's label
 *     (works on leaf pages where the dynamic segment IS the last
 *     crumb — e.g. /meal/[id] → "Recipe" → meal name).
 *   - `useSetBreadcrumb(label, targetLabel)` replaces the FIRST
 *     crumb whose static label matches `targetLabel` (works on
 *     deeper pages where the dynamic segment is mid-trail — e.g.
 *     /meal/[id]/refine has [Cook, Library, Recipe, Refine] and
 *     wants "Recipe" replaced with the meal name while "Refine"
 *     stays the suffix).
 *
 * Cleanup runs on unmount so back-navigation falls through to the
 * static trail without stale overrides.
 *
 * Coexists with the legacy R23 `BreadcrumbLabelProvider` (keyed by
 * href, currently unused since R26 retired `AppBreadcrumb`). The R23
 * provider can be cleaned up in a follow-up.
 */

type BreadcrumbOverride = {
  /** New label to render. */
  label: string;
  /** When set, replace the first crumb whose static label equals this.
   *  Otherwise replace the LAST crumb. */
  targetLabel?: string;
};

type BreadcrumbContextValue = {
  override: BreadcrumbOverride | null;
  setOverride: (override: BreadcrumbOverride | null) => void;
};

const BreadcrumbContext = React.createContext<BreadcrumbContextValue>({
  override: null,
  setOverride: () => {}
});

export function BreadcrumbProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const [override, setOverride] = React.useState<BreadcrumbOverride | null>(
    null
  );
  const value = React.useMemo(
    () => ({ override, setOverride }),
    [override]
  );
  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

/**
 * Page-level hook. Sets the breadcrumb override for the lifetime of
 * the calling component; clears on unmount.
 *
 *   - `useSetBreadcrumb(meal.name)` — replaces last crumb. Works on
 *     leaf routes.
 *   - `useSetBreadcrumb(meal.name, "Recipe")` — replaces the first
 *     "Recipe" crumb wherever it appears. Works on deeper trails
 *     where the dynamic segment isn't the last crumb.
 */
export function useSetBreadcrumb(
  label: string | null,
  targetLabel?: string
): void {
  const { setOverride } = React.useContext(BreadcrumbContext);
  React.useEffect(() => {
    if (label === null) {
      setOverride(null);
      return;
    }
    setOverride({ label, targetLabel });
    return () => setOverride(null);
  }, [label, targetLabel, setOverride]);
}

/**
 * Consumer hook for the TopBar. Returns the current override, or
 * `null` when no page has set one — the TopBar falls back to
 * `getCrumbs(pathname)` unchanged.
 */
export function useBreadcrumbOverride(): BreadcrumbOverride | null {
  return React.useContext(BreadcrumbContext).override;
}
