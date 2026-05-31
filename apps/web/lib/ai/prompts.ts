/**
 * Prompt for generating a fallback dish photo (gpt-image-1) when a meal has
 * no user-supplied image. Aims for a believable, appetizing food photo — not
 * an illustration — and explicitly bans text/watermarks so the image reads as
 * a real plated dish rather than a recipe card.
 */
export function buildDishImagePrompt(dishName: string): string {
  return `A high-quality, appetizing food photograph of "${dishName}". A single serving plated on a simple ceramic dish, shot from a slight overhead angle on a clean neutral surface with soft natural daylight and shallow depth of field. Realistic, editorial food-photography style. No text, no labels, no watermarks, no hands, no people.`;
}

export const SUGGEST_FROM_IMAGE_PROMPT = `Look at this image and determine whether it shows:
(a) A finished dish or prepared meal
(b) A recipe card, cookbook page, or written/printed recipe

If it is a finished dish:
- Name the dish concisely (2–5 words, e.g. "Lemon herb chicken bowls")
- Estimate the effort to cook it: quick (under 15 min), easy (simple, 15–30 min), medium (30–60 min), high_effort (over 60 min or technically complex)
- Write a brief note about what you observe — one sentence at most
- Leave recipeText empty
- Leave ingredients as an empty array (the dish photo doesn't tell you the ingredient list)

If it is a recipe card or written recipe:
- Use the recipe title as the name
- Estimate effort from the ingredients and steps
- Extract the full recipe text including ingredients and method steps as recipeText
- Also extract ingredients as an ordered array of strings. Each entry is one ingredient line as the recipe presents it — preserve quantities, units, and qualifiers ("to taste", "optional", "or ghee"). Follow the order on the recipe card.
- Leave notes empty

Set confidence to "high" if the image is clear and the identification is certain, "medium" if reasonably sure, or "low" if the image is blurry, ambiguous, or you are guessing.

Return your answer in the required format.`;

export function buildSharePrompt(
  mealName: string,
  recipeText: string,
  notes?: string | null,
  householdName?: string | null
): string {
  const notesSection = notes?.trim() ? `\nCook's notes: ${notes.trim()}` : "";
  // Household names follow the default "<Name>'s Kitchen" / "My Kitchen"
  // pattern. The instruction is a literal-string requirement so the model
  // doesn't paraphrase "Saved in Alex's Kitchen" into "Saved in the Alex's
  // Kitchen kitchen" — phrasings that read awkwardly with the default.
  const attributionRule = householdName?.trim()
    ? `\n- End the message with one final line, by itself, exactly: Saved in ${householdName.trim()} · eeatly.app`
    : "";
  return `Turn the following recipe into a friendly WhatsApp message to share with family.

Rules:
- Begin with a warm one-line intro that mentions the dish name
- List ingredients on separate lines (no bullet symbols, no asterisks, no dashes)
- Number each step on its own line
- If there are cook's notes, weave them in naturally after the steps as a tip
- Close with a brief warm sign-off suitable for family sharing${attributionRule}
- Plain text ONLY — absolutely no markdown, no asterisks, no bold, no headers, no symbols
- Total length: under 1500 characters

Dish name: ${mealName}

Recipe:
${recipeText}${notesSection}`;
}

export const SUGGEST_FROM_VOICE_NOTE_PROMPT = `This is a transcript of a voice note describing a recipe. The speaker may have rambled, corrected themselves, repeated ingredients, or shared asides ("you know, like my mother used to make"). Extract:

- name: the dish's name as commonly known. If the dish has a traditional Urdu/Hindi/regional name, prefer that (e.g., "Chicken Karahi" not "Chicken Curry"); concise (2–5 words).
- effortGuess: cooking effort — quick (under 15 min), easy (15–30 min), medium (30–60 min), high_effort (over 60 min or technically complex).
- notes: cooking tips worth remembering, max 2 sentences. Corrections and asides often contain these — surface non-obvious technique or a specific tip the speaker emphasized. Empty string if nothing stands out.
- recipeText: ingredients then steps, cleaned up into a readable recipe — preserve quantities and methods, drop fillers, repetitions, and tangents. Plain text only.
- ingredients: an ordered array of strings — one ingredient line each, in the order the speaker mentioned them. Speakers often skip quantities — a bare "ginger paste" is fine when no quantity was given. Be lenient. Empty array if no ingredients were named.
- confidence: "high" if the transcript clearly described a complete recipe, "medium" if some details required inference, "low" if the transcript was fragmented or barely recipe-shaped.

If the transcript is in Urdu/Hindi/mixed, produce the recipe in English while keeping the traditional dish name in the name field.

Transcript:`;

/**
 * Round 10 — focused ingredient-only extraction for legacy meals
 * (Task 5). The full SUGGEST_FROM_TEXT prompt would also re-derive the
 * dish name + effort + notes, which is wasted tokens (and risks
 * clobbering whatever the user already saved on the meal row). This
 * prompt returns ONLY the ingredient list.
 *
 * The provider call is wired through `extractIngredientsFromText` in
 * services/ai.ts and asks the model for plain JSON `{ ingredients:
 * string[] }`; no tool-use shim needed because there's nothing else to
 * parse out.
 */
export const EXTRACT_INGREDIENTS_FROM_TEXT_PROMPT = `Below is a recipe written as free-form text. Extract just the ingredient list as an ordered JSON array of strings.

Rules:
- Each entry is one ingredient line as the recipe presents it. Preserve quantities, units, and qualifiers ("to taste", "optional", "or ghee").
- Follow the order the recipe uses.
- If the recipe has no clear ingredient list (e.g. it's only a method or it's not a recipe at all), return an empty array.
- Plain text only. No markdown, no asterisks, no leading bullet symbols inside the strings.

Respond ONLY with JSON of the shape: { "ingredients": ["1 cup basmati rice", "2 tbsp ghee", ...] }

Recipe:`;

/**
 * Round 18 — Refine prompt. Different shape from Capture: Capture
 * extracts a recipe from raw input; Refine diffs an existing recipe
 * against a user instruction and emits a `PendingChange[]` list.
 *
 * The recipe context is rendered as compact JSON the model can read
 * cheaply. The diff schema mirrors `packages/api/src/validators/refine.ts`
 * verbatim — Zod parses on the way out so any drift here surfaces as
 * a 400 at the procedure layer rather than corrupt rows downstream.
 */
export const REFINE_RECIPE_PROMPT = `You are helping a home cook refine a recipe. They may be EDITING a recipe that already has ingredients and steps, OR fleshing out one that is still just a dish name (empty, or only a free-form "recipeText" blob with no structured rows). In all cases you emit a structured diff against the recipe.

DIFF SCHEMA — return ONLY this shape:

{
  "proposed": [
    // For each change, one of:
    {"id": "<short stable id>", "kind": "add", "target": "ingredient", "payload": { "name": "Ginger paste", "quantityString": "1 tbsp", "prepNote": null }, "whereHint": "step 1 marinade"},
    {"id": "<id>", "kind": "add", "target": "step", "payload": { "title": "Garnish & serve", "time": "2 min", "body": "Finish with chopped cilantro and a wedge of lime.", "ingredientIds": [] }, "whereHint": "after step 5"},
    {"id": "<id>", "kind": "change", "target": "ingredient", "refId": "<ingredient row id from input>", "field": "quantityString", "before": "400 g", "after": "600 g"},
    {"id": "<id>", "kind": "change", "target": "step", "refId": "<step row id from input>", "field": "body", "before": "...old body...", "after": "...new body..."},
    {"id": "<id>", "kind": "remove", "target": "ingredient", "refId": "<row id>", "before": { "name": "Salt", "quantityString": "1 tsp", "prepNote": null }}
  ],
  "rationale": "one-line summary of what you changed"
}

Rules:
- BUILDING FROM SCRATCH: If the recipe has NO structured ingredients and NO structured steps, treat the instruction as a request to CREATE a complete, sensible recipe for the dish named in the input. Propose "add" ingredients and "add" steps that make a realistic recipe for that dish, shaped by the instruction (e.g. "make it spicier" → build a spicier version; "add prep notes" → include prep notes on the ingredients you add). If a free-form "recipeText" blob is present, convert it into structured "add" ingredients and steps. Aim for a usable recipe (roughly 4–10 ingredients and 2–6 steps) unless the instruction asks for something smaller.
- NEVER return an empty "proposed" array when the instruction is actionable. An empty recipe plus any cooking instruction is always actionable — build it.
- EVERY "add" step payload MUST have a non-empty "title" (a short step name like "Sear the patties") AND a non-empty "body" (the full instruction sentence, e.g. "Heat a skillet over medium-high and sear the patties 2–3 min per side until browned."). Never emit a step with an empty or placeholder title/body.
- "whereHint" is ONLY a brief placement note ("at the end", "after the marinade step") — NEVER put the step's name or instructions in whereHint. For a from-scratch build, you can omit whereHint and rely on the order of your "add" steps in the array.
- Use ONLY refIds that appear in the input recipe — never invent ids.
- For "add", omit refId entirely. Use whereHint to describe placement in plain language.
- For "change", the "field" must be a column name like "name", "quantityString", "prepNote", "title", "time", "body".
- Keep quantityString free-form ("400 g", "½ tsp", "1 large"). Do NOT parse into number + unit.
- If the user's instruction touches multiple things (e.g. "bump chicken to 600g and add ginger paste"), emit one change per affected row.
- If a change cascades (e.g. updating an ingredient quantity also requires rewriting the step that mentions it), emit BOTH changes — one for the ingredient, one for the step body.
- Keep the proposed array under 20 entries. If the instruction is unreasonably broad, prefer the most impactful changes.
- ids in your output should be short stable strings ("c1", "c2", …). Server will assign real ids.

WRONG (do NOT do this) — a step with no title/body, content hidden in whereHint:
  {"id": "c5", "kind": "add", "target": "step", "payload": {}, "whereHint": "sear the patties"}

RIGHT — title + body filled, whereHint omitted:
  {"id": "c5", "kind": "add", "target": "step", "payload": {"title": "Sear the patties", "time": "6 min", "body": "Heat a skillet over medium-high. Sear the patties 2–3 minutes per side until browned and cooked through.", "ingredientIds": []}}

Full from-scratch example — instruction "build the recipe" on an empty "Beef Sliders":
  {"proposed": [
    {"id": "c1", "kind": "add", "target": "ingredient", "payload": {"name": "Ground beef", "quantityString": "500 g", "prepNote": null}},
    {"id": "c2", "kind": "add", "target": "ingredient", "payload": {"name": "Slider buns", "quantityString": "8", "prepNote": "halved"}},
    {"id": "c3", "kind": "add", "target": "step", "payload": {"title": "Form the patties", "time": "5 min", "body": "Divide the beef into 8 portions and press into thin patties slightly wider than the buns.", "ingredientIds": []}},
    {"id": "c4", "kind": "add", "target": "step", "payload": {"title": "Cook and assemble", "time": "8 min", "body": "Sear the patties 2 minutes per side, then assemble each in a bun.", "ingredientIds": []}}
  ], "rationale": "Built a basic beef sliders recipe with ingredients and steps."}

Return ONLY the JSON object described above. No prose before or after.`;

export const SUGGEST_FROM_TEXT_PROMPT = `The user has pasted text about a meal or recipe. Extract the following information:

- name: the dish name, concise (2–5 words)
- effortGuess: cooking effort — quick (under 15 min), easy (15–30 min), medium (30–60 min), high_effort (over 60 min or technically complex)
- notes: any useful tips or notable aspects in 1–2 sentences, or an empty string if nothing stands out
- recipeText: if a recipe is present in the text, extract it fully (ingredients and steps); otherwise leave empty
- ingredients: an ordered array of strings. Each entry is one ingredient line as the text presents it — preserve quantities, units, and qualifiers ("to taste", "optional", "or ghee"). If the text has a clear ingredients section, preserve that order. If ingredients are scattered through prose, extract them in the order they appear. Empty array if the text doesn't describe a recipe with ingredients.
- confidence: "high" if the text clearly describes a specific dish, "medium" if somewhat ambiguous, "low" if very unclear

Return your answer in the required format.

Text to analyse:`;
