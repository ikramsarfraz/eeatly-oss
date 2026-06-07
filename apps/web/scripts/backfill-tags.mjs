/**
 * R36 Library — one-time backfill seed for recipe tags (faceted filters).
 *
 * Self-contained on purpose: a keyword heuristic + raw SQL via the Neon HTTP
 * client, with NO app imports (so it sidesteps `server-only` and the Next module
 * graph and runs as a plain node script). It seeds the single-select facets
 * (cuisine / course / main ingredient) for every still-untagged, non-deleted
 * recipe so the filters have data immediately; the AI tagger (capture path +
 * the `meals.generateTags` mutation) refines Diet/Occasion over time, and it
 * never touches a meal a user has hand-tagged (`tags_source = 'user'`).
 *
 * Usage (from apps/web): pnpm db:backfill:tags
 */
import { neon } from "@neondatabase/serverless";

const CUISINE = [
  [/biryani|masala|tikka|paneer|\bdal\b|tandoori|korma|rogan|saag|aloo|chana|naan|vindaloo/i, "Indian"],
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
const MAIN = [
  [/salmon|shrimp|prawn|\bfish\b|tuna|cod|crab|clam|scampi|seafood|calamari/i, "Seafood"],
  [/chicken|poultry/i, "Chicken"],
  [/\bbeef\b|steak|brisket|bulgogi|rendang/i, "Beef"],
  [/\bpork\b|bacon|sausage|\bham\b|carbonara|gyoza/i, "Pork"],
  [/\blamb\b|mutton|rogan|moussaka/i, "Lamb"],
  [/tofu|paneer/i, "Tofu"],
  [/\begg|omelet|shakshuka|frittata/i, "Egg"]
];
const COURSE = [
  [/soup|chowder|\bpho\b|ramen|bisque|stew/i, "Soup"],
  [/salad|slaw|tabbouleh/i, "Salad"],
  [/pancake|waffle|omelet|shakshuka|rancheros|granola|congee|breakfast/i, "Breakfast"],
  [/cake|cookie|brownie|\bpie\b|dessert|ice cream|pudding|tart/i, "Dessert"]
];
const match = (text, table) => {
  for (const [re, v] of table) if (re.test(text)) return v;
  return null;
};

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[backfill-tags] DATABASE_URL not set");
    process.exit(1);
  }
  const sql = neon(url);

  const rows = await sql`
    SELECT id, name FROM meals
    WHERE tags_source IS NULL AND deleted_at IS NULL
  `;
  console.log(`[backfill-tags] ${rows.length} untagged recipes`);

  let done = 0;
  for (const row of rows) {
    const text = String(row.name).toLowerCase();
    const cuisine = match(text, CUISINE);
    const course = match(text, COURSE) ?? "Dinner";
    const main = match(text, MAIN) ?? "Veg";
    await sql`
      UPDATE meals
      SET cuisine = ${cuisine}, course = ${course}, main_ingredient = ${main},
          tags_source = 'heuristic', tagged_at = now(), updated_at = now()
      WHERE id = ${row.id}
    `;
    done++;
    if (done % 25 === 0) console.log(`[backfill-tags] ${done}/${rows.length}`);
  }
  console.log(`[backfill-tags] done — tagged ${done} recipes`);
}

main().catch((e) => {
  console.error("[backfill-tags] fatal:", e);
  process.exit(1);
});
