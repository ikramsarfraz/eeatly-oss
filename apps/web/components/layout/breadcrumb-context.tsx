"use client";

import * as React from "react";

/**
 * Round 28 — dynamic breadcrumb override.
 *
 * R26's TopBar reads static breadcrumbs from `getCrumbs(pathname)` in
 * `lib/nav/breadcrumbs.ts`. The last segment for dynamic routes
 * (Recipe Detail, Plan Detail, etc.) is a generic placeholder
 * ("Recipe", "Plan"). This context lets the active page replace that
 * last-crumb label with a concrete value pulled from data —
 * `useSetBreadcrumb(meal.name)` in `RecipeDetailClient`, etc.
 *
 * Scope is intentionally narrow:
 *   - Single string override (replaces only the last static crumb).
 *   - One active override per provider scope; the cleanup function
 *     resets to `null` on unmount so back-navigation falls through to
 *     the static label without a stale value.
 *   - Intermediate crumbs are never overridden — those are stable
 *     ("Cook", "Library") and the static map owns them.
 *
 * Coexists with the legacy R23 `BreadcrumbLabelProvider`. That one is
 * keyed by `href` and currently unused (R26's TopBar replaced the old
 * `AppBreadcrumb` consumer); the new context here is the R26-shaped
 * equivalent. The legacy provider can be cleaned up in a follow-up
 * once no consumers remain.
 */

type BreadcrumbContextValue = {
  override: string | null;
  setOverride: (label: string | null) => void;
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
  const [override, setOverride] = React.useState<string | null>(null);
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
 * Page-level hook. Sets the last-crumb override for the lifetime of
 * the calling component; clears on unmount. Pass a `null` label to
 * explicitly clear without unmounting.
 */
export function useSetBreadcrumb(label: string | null): void {
  const { setOverride } = React.useContext(BreadcrumbContext);
  React.useEffect(() => {
    setOverride(label);
    return () => setOverride(null);
  }, [label, setOverride]);
}

/**
 * Consumer hook for the TopBar. Returns the current override, or
 * `null` when no page has set one — the TopBar falls back to
 * `getCrumbs(pathname)` unchanged.
 */
export function useBreadcrumbOverride(): string | null {
  return React.useContext(BreadcrumbContext).override;
}
