import type { MealTags } from "@/lib/meals/tags";

/**
 * R36 — keyword heuristic for recipe tags. Used as the fallback when the AI
 * tagger is unavailable (no key / error) so the Library filters always have
 * something to work with, and as a cheap seed for the backfill. Deliberately
 * conservative: it only sets a facet when a keyword clearly implies it, leaving
 * the rest null/empty for the AI or the user to fill in.
 */

const CUISINE_KEYWORDS: [RegExp, string][] = [
  [/biryani|masala|tikka|paneer|\bdal\b|tandoori|korma|rogan|saag|aloo|chana|samosa|naan|vindaloo/i, "Indian"],
  [/pizza|pasta|risotto|carbonara|lasagna|gnocchi|parm|pesto|caprese|scampi|marinara|bolognese/i, "Italian"],
  [/taco|burrito|quesadilla|enchilada|salsa|guac|fajita|nachos|chili con|rancheros/i, "Mexican"],
  [/ramen|sushi|teriyaki|katsu|miso|udon|tempura|gyoza|okonomiyaki|donburi|yakitori/i, "Japanese"],
  [/pad thai|tom yum|green curry|massaman|thai/i, "Thai"],
  [/bibimbap|bulgogi|kimchi|gochujang|korean/i, "Korean"],
  [/\bpho\b|banh mi|spring roll|vietnam/i, "Vietnamese"],
  [/shawarma|falafel|hummus|tabbouleh|shakshuka|kebab|tahini/i, "Middle Eastern"],
  [/souvlaki|tzatziki|moussaka|gyro|greek/i, "Greek"],
  [/chow ?mein|fried rice|kung pao|szechuan|congee|dumpling|lo mein|wonton/i, "Chinese"],
  [/ratatouille|croque|coq au|french/i, "French"],
  [/paella|tapas|chorizo|spanish/i, "Spanish"],
  [/burger|bbq|mac and cheese|meatloaf|chowder|pulled pork|cornbread|sloppy/i, "American"]
];

const MAIN_KEYWORDS: [RegExp, string][] = [
  [/salmon|shrimp|prawn|\bfish\b|tuna|cod|crab|clam|scampi|seafood|calamari/i, "Seafood"],
  [/chicken|poultry/i, "Chicken"],
  [/\bbeef\b|steak|brisket|bulgogi|rendang/i, "Beef"],
  [/\bpork\b|bacon|sausage|ham|carbonara|gyoza/i, "Pork"],
  [/\blamb\b|mutton|rogan|moussaka/i, "Lamb"],
  [/tofu|paneer/i, "Tofu"],
  [/\begg|omelet|shakshuka|frittata/i, "Egg"]
];

const COURSE_KEYWORDS: [RegExp, string][] = [
  [/soup|chowder|\bpho\b|ramen|bisque|stew/i, "Soup"],
  [/salad|slaw|tabbouleh/i, "Salad"],
  [/pancake|waffle|omelet|shakshuka|rancheros|granola|congee|\bbreakfast/i, "Breakfast"],
  [/cake|cookie|brownie|pie|dessert|ice cream|pudding|tart/i, "Dessert"]
];

function firstMatch(text: string, table: [RegExp, string][]): string | null {
  for (const [re, value] of table) if (re.test(text)) return value;
  return null;
}

export function heuristicTags(name: string): MealTags {
  const text = name.toLowerCase();
  const main = firstMatch(text, MAIN_KEYWORDS) ?? "Veg";
  const diet: string[] = main === "Veg" || main === "Tofu" || main === "Egg" ? [] : [];
  return {
    cuisine: firstMatch(text, CUISINE_KEYWORDS),
    course: firstMatch(text, COURSE_KEYWORDS) ?? "Dinner",
    mainIngredient: main,
    diet,
    occasion: []
  };
}
