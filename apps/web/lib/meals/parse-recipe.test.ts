import { describe, expect, it } from "vitest";
import { parseStructuredRecipe } from "./parse-recipe";

const MARKDOWN_RECIPE = `### Ingredients
- 500 g beef sirloin, thinly sliced
- 4 cloves of garlic, minced
- 1 tbsp ground cumin

### Instructions
1. In a bowl, mix the minced garlic and cumin to make a marinade.
2. Add the thinly sliced beef to the marinade.
3. Cook the marinated beef slices until browned, about 5-7 minutes.`;

describe("parseStructuredRecipe", () => {
  it("splits a markdown ### Ingredients / ### Instructions blob", () => {
    const out = parseStructuredRecipe(MARKDOWN_RECIPE, null);
    expect(out.ingredients.map((i) => i.name)).toEqual([
      "500 g beef sirloin, thinly sliced",
      "4 cloves of garlic, minced",
      "1 tbsp ground cumin"
    ]);
    expect(out.steps).toHaveLength(3);
    expect(out.steps[0].body).toBe("In a bowl, mix the minced garlic and cumin to make a marinade.");
    // Numbering + bullets are stripped; single instructions carry no title.
    expect(out.steps[0].title).toBe("");
    expect(out.steps[2].body).toBe("Cook the marinated beef slices until browned, about 5-7 minutes.");
  });

  it("prefers the AI-separated ingredients array for ingredients", () => {
    const out = parseStructuredRecipe(MARKDOWN_RECIPE, ["Beef", "Garlic"]);
    expect(out.ingredients.map((i) => i.name)).toEqual(["Beef", "Garlic"]);
    // Steps still parse from the blob.
    expect(out.steps).toHaveLength(3);
  });

  it("detects a numbered step list without an Instructions header", () => {
    const blob = `Beef stew\n1. Brown the beef.\n2. Add stock and simmer.\n3. Serve hot.`;
    const out = parseStructuredRecipe(blob, ["beef", "stock"]);
    expect(out.steps.map((s) => s.body)).toEqual([
      "Brown the beef.",
      "Add stock and simmer.",
      "Serve hot."
    ]);
  });

  it("leaves steps empty when nothing parseable (keeps legacy prose fallback)", () => {
    const out = parseStructuredRecipe("Just some loose notes about a dish.", null);
    expect(out.steps).toEqual([]);
  });

  it("handles empty / null input", () => {
    expect(parseStructuredRecipe(null, null)).toEqual({ ingredients: [], steps: [] });
    expect(parseStructuredRecipe("", [])).toEqual({ ingredients: [], steps: [] });
  });
});
