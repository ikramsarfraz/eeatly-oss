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

export const SUGGEST_FROM_YOUTUBE_PROMPT = `The text below is a transcript of a cooking video. It may include intro chatter, repetitions, ad reads, and informal language. Extract a clean, useful recipe from it.

Return:
- name: the dish name, concise (2–5 words). If the dish has a traditional Urdu/Hindi/regional name, lead with English but mention the traditional name in notes.
- effortGuess: cooking effort — quick (under 15 min), easy (15–30 min), medium (30–60 min), high_effort (over 60 min or technically complex)
- notes: 1–2 sentences of cook's-eye observations worth remembering — non-obvious technique, why a step matters, common mistakes the cook flagged. Don't summarize the recipe — that goes in recipeText. Empty string if nothing stands out.
- recipeText: a CLEAN recipe. List ingredients with rough quantities (best-guess if the speaker was vague). Number the steps. Strip filler ("welcome back", "don't forget to subscribe", brand mentions). Plain text only.
- ingredients: an ordered array of strings — one ingredient line each, in the order they appear in the transcript. Include any quantity the speaker mentioned ("1 tbsp ginger paste"), but a bare "ginger paste" is fine when no quantity was given. Be lenient: cooking videos often scatter ingredients through the talk track. Empty array if the transcript never names ingredients.
- confidence: "high" if the transcript clearly described a complete recipe, "medium" if some details required inference, "low" if the transcript was fragmented or barely recipe-shaped.

Transcript:`;

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

export const SUGGEST_FROM_TEXT_PROMPT = `The user has pasted text about a meal or recipe. Extract the following information:

- name: the dish name, concise (2–5 words)
- effortGuess: cooking effort — quick (under 15 min), easy (15–30 min), medium (30–60 min), high_effort (over 60 min or technically complex)
- notes: any useful tips or notable aspects in 1–2 sentences, or an empty string if nothing stands out
- recipeText: if a recipe is present in the text, extract it fully (ingredients and steps); otherwise leave empty
- ingredients: an ordered array of strings. Each entry is one ingredient line as the text presents it — preserve quantities, units, and qualifiers ("to taste", "optional", "or ghee"). If the text has a clear ingredients section, preserve that order. If ingredients are scattered through prose, extract them in the order they appear. Empty array if the text doesn't describe a recipe with ingredients.
- confidence: "high" if the text clearly describes a specific dish, "medium" if somewhat ambiguous, "low" if very unclear

Return your answer in the required format.

Text to analyse:`;
