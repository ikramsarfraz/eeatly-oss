import type { FacetKey } from "@/lib/meals/tags";
import { FACET_GROUPS } from "@/lib/meals/tags";

/**
 * R36 Library — faceted filtering logic, shared by the desktop popover + the
 * mobile sheet. Selection model: multi-select per group, **OR within a group,
 * AND across groups**. Counts are *faceted* — recomputed against every other
 * selected group so they guide narrowing. Pure functions; no React.
 */

/** The minimum a row needs to be faceted: its tags + its cook-effort. */
export type FacetRow = {
  cuisine: string | null;
  course: string | null;
  mainIngredient: string | null;
  diet: string[];
  occasion: string[];
  effort: string | null;
};

export type FacetState = Record<FacetKey, Set<string>>;

export function emptyFacetState(): FacetState {
  return { cuisine: new Set(), course: new Set(), main: new Set(), diet: new Set(), effort: new Set(), occasion: new Set() };
}

export function cloneFacetState(s: FacetState): FacetState {
  return {
    cuisine: new Set(s.cuisine),
    course: new Set(s.course),
    main: new Set(s.main),
    diet: new Set(s.diet),
    effort: new Set(s.effort),
    occasion: new Set(s.occasion)
  };
}

export function totalSelected(s: FacetState): number {
  return FACET_GROUPS.reduce((n, g) => n + s[g.key].size, 0);
}

/** The values a row carries for a given facet group (empty when untagged). */
export function valuesForFacet(row: FacetRow, key: FacetKey): string[] {
  switch (key) {
    case "cuisine":
      return row.cuisine ? [row.cuisine] : [];
    case "course":
      return row.course ? [row.course] : [];
    case "main":
      return row.mainIngredient ? [row.mainIngredient] : [];
    case "diet":
      return row.diet;
    case "occasion":
      return row.occasion;
    case "effort":
      return row.effort ? [row.effort] : [];
  }
}

/** A row matches when, for every group with a selection, the row has at least
 *  one of the selected values (OR within group); groups combine with AND. */
export function matchesFacets(row: FacetRow, state: FacetState, except?: FacetKey): boolean {
  for (const g of FACET_GROUPS) {
    if (g.key === except) continue;
    const sel = state[g.key];
    if (sel.size === 0) continue;
    const vals = valuesForFacet(row, g.key);
    if (!vals.some((v) => sel.has(v))) return false;
  }
  return true;
}

/** Distinct values present per group, for building the option lists. */
export function facetOptions(rows: FacetRow[]): Record<FacetKey, string[]> {
  const out = emptyFacetState();
  for (const row of rows) {
    for (const g of FACET_GROUPS) {
      for (const v of valuesForFacet(row, g.key)) out[g.key].add(v);
    }
  }
  const collator = new Intl.Collator();
  const sorted = {} as Record<FacetKey, string[]>;
  for (const g of FACET_GROUPS) {
    sorted[g.key] = [...out[g.key]].sort((a, b) => collator.compare(a, b));
  }
  return sorted;
}

/** Faceted counts: for each group value, how many rows match all OTHER selected
 *  groups AND carry that value. Drives the live count badges. */
export function facetCounts(rows: FacetRow[], state: FacetState): Record<FacetKey, Record<string, number>> {
  const counts = {} as Record<FacetKey, Record<string, number>>;
  for (const g of FACET_GROUPS) counts[g.key] = {};
  for (const row of rows) {
    for (const g of FACET_GROUPS) {
      // Count this value if the row passes every group except this one.
      if (!matchesFacets(row, state, g.key)) continue;
      for (const v of valuesForFacet(row, g.key)) {
        counts[g.key][v] = (counts[g.key][v] ?? 0) + 1;
      }
    }
  }
  return counts;
}
