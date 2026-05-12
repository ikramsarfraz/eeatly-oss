export const SUGGEST_FROM_IMAGE_PROMPT = `Look at this image and determine whether it shows:
(a) A finished dish or prepared meal
(b) A recipe card, cookbook page, or written/printed recipe

If it is a finished dish:
- Name the dish concisely (2–5 words, e.g. "Lemon herb chicken bowls")
- Estimate the effort to cook it: quick (under 15 min), easy (simple, 15–30 min), medium (30–60 min), high_effort (over 60 min or technically complex)
- Write a brief note about what you observe — one sentence at most
- Leave recipeText empty

If it is a recipe card or written recipe:
- Use the recipe title as the name
- Estimate effort from the ingredients and steps
- Extract the full recipe text including ingredients and method steps as recipeText
- Leave notes empty

Set confidence to "high" if the image is clear and the identification is certain, "medium" if reasonably sure, or "low" if the image is blurry, ambiguous, or you are guessing.

Return your answer in the required format.`;

export function buildSharePrompt(mealName: string, recipeText: string, notes?: string | null): string {
  const notesSection = notes?.trim() ? `\nCook's notes: ${notes.trim()}` : "";
  return `Turn the following recipe into a friendly WhatsApp message to share with family.

Rules:
- Begin with a warm one-line intro that mentions the dish name
- List ingredients on separate lines (no bullet symbols, no asterisks, no dashes)
- Number each step on its own line
- If there are cook's notes, weave them in naturally after the steps as a tip
- Close with a brief warm sign-off suitable for family sharing
- Plain text ONLY — absolutely no markdown, no asterisks, no bold, no headers, no symbols
- Total length: under 1500 characters

Dish name: ${mealName}

Recipe:
${recipeText}${notesSection}`;
}

export const SUGGEST_FROM_TEXT_PROMPT = `The user has pasted text about a meal or recipe. Extract the following information:

- name: the dish name, concise (2–5 words)
- effortGuess: cooking effort — quick (under 15 min), easy (15–30 min), medium (30–60 min), high_effort (over 60 min or technically complex)
- notes: any useful tips or notable aspects in 1–2 sentences, or an empty string if nothing stands out
- recipeText: if a recipe is present in the text, extract it fully (ingredients and steps); otherwise leave empty
- confidence: "high" if the text clearly describes a specific dish, "medium" if somewhat ambiguous, "low" if very unclear

Return your answer in the required format.

Text to analyse:`;
