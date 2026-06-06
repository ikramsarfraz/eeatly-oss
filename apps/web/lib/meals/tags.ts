/**
 * R36 Library — recipe tag taxonomy (faceted filtering + AI auto-tagging).
 *
 * Single-select facets (cuisine / course / main ingredient) are stored as a
 * column each; Diet + Occasion are arrays. The vocab below is a *guide* for the
 * AI and the Edit-tags pickers, NOT a hard enum — tags are free-form text, and
 * the Filters panel derives its option list from the values actually present in
 * the library. Seeded from the handoff's `EEATLY_FACETS` + sample taxonomy.
 */

export type MealTags = {
  cuisine: string | null;
  course: string | null;
  mainIngredient: string | null;
  diet: string[];
  occasion: string[];
};

export const EMPTY_TAGS: MealTags = {
  cuisine: null,
  course: null,
  mainIngredient: null,
  diet: [],
  occasion: []
};

/** Facet groups shown in the Filters panel, in display order. `effort` is not a
 *  tag column — it comes from the per-recipe cook-effort stat. */
export type FacetKey = "cuisine" | "course" | "main" | "diet" | "effort" | "occasion";

export const FACET_GROUPS: { key: FacetKey; label: string }[] = [
  { key: "cuisine", label: "Cuisine" },
  { key: "course", label: "Course" },
  { key: "main", label: "Main ingredient" },
  { key: "diet", label: "Diet" },
  { key: "effort", label: "Effort" },
  { key: "occasion", label: "Occasion" }
];

// Guidance vocab for the AI tagger + the Edit-tags pickers.
export const CUISINE_OPTIONS = [
  "American", "Italian", "Mexican", "Indian", "Chinese", "Thai", "Japanese", "Korean",
  "Vietnamese", "Mediterranean", "Middle Eastern", "Greek", "French", "Spanish", "British",
  "Indonesian", "West African", "Caribbean", "German", "Other"
];

export const COURSE_OPTIONS = [
  "Breakfast", "Brunch", "Lunch", "Dinner", "Appetizer", "Side", "Salad", "Soup", "Snack", "Dessert"
];

export const MAIN_OPTIONS = ["Veg", "Chicken", "Beef", "Pork", "Seafood", "Lamb", "Tofu", "Egg", "Other"];

export const DIET_OPTIONS = [
  "Vegetarian", "Vegan", "Gluten-free", "Dairy-free", "Pescatarian", "Keto", "Halal"
];

/** Occasion tags the AI suggests; users accept/correct them in Edit-tags. */
export const OCCASION_OPTIONS = [
  "Weeknight", "Meal prep", "Comfort food", "Crowd-pleaser", "Date night", "One pan", "Special occasion"
];

export const EFFORT_FACET_OPTIONS = [
  { value: "quick", label: "Quick" },
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "high_effort", label: "High effort" }
];

/** Title-case display for an effort value. */
export function effortLabel(value: string | null | undefined): string {
  if (!value) return "";
  return value === "high_effort" ? "High effort" : value.charAt(0).toUpperCase() + value.slice(1);
}

/** True when a recipe has no tags at all (drives the "Untagged" affordance). */
export function isUntagged(t: MealTags): boolean {
  return !t.cuisine && !t.course && !t.mainIngredient && t.diet.length === 0 && t.occasion.length === 0;
}
