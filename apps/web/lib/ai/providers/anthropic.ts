import "server-only";

import { getAnthropicClient } from "@/lib/ai/client";
import { recordAiTokens } from "@/lib/ai/usage-context";
import {
  buildSharePrompt,
  EXTRACT_INGREDIENTS_FROM_TEXT_PROMPT,
  REFINE_RECIPE_PROMPT,
  SUGGEST_FROM_IMAGE_PROMPT,
  SUGGEST_FROM_TEXT_PROMPT,
  SUGGEST_FROM_VOICE_NOTE_PROMPT,
  unitsDirective
} from "@/lib/ai/prompts";
import type { MeasurementSystem } from "@/lib/units/detect";
import type { MealSuggestion } from "@/types";
import {
  proposeChangesResponseSchema,
  type ProposeChangesResponse
} from "@eeatly/api/validators/refine";

type SupportedMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

// Fallback timeout intentionally longer than the primary's (7s on OpenAI).
// We've already paid the primary's failure latency before this fires, so
// "fail fast" doesn't help — we'd rather wait the full budget for an
// answer than show "both providers down" for a transient blip.
const FALLBACK_TIMEOUT_MS = 15_000;

// Refine's from-scratch recipe build generates a large diff; the 15s
// fallback budget aborts it. Give the refine fallback more room (it only
// fires after the primary already failed).
const REFINE_FALLBACK_TIMEOUT_MS = 26_000;

const suggestMealTool = {
  name: "suggest_meal",
  description: "Return a structured meal suggestion extracted from the provided image or text.",
  input_schema: {
    type: "object" as const,
    properties: {
      name: { type: "string", description: "The dish name, concise (2–5 words)" },
      effortGuess: {
        type: "string",
        enum: ["quick", "easy", "medium", "high_effort"],
        description: "Estimated cooking effort level"
      },
      notes: { type: "string", description: "Brief tip or observation, 1–2 sentences max, or empty string" },
      recipeText: { type: "string", description: "Full recipe text if a recipe was detected, otherwise empty string" },
      ingredients: {
        type: "array",
        items: { type: "string" },
        description:
          "Ordered ingredient lines as they appear in the source ('1 cup basmati rice'). Empty array if no ingredients were named."
      },
      servings: {
        type: "string",
        description:
          "Free-form yield/servings exactly as the source states it ('Serves 4', 'Makes 8 sliders', 'Feeds 6'). Empty string if no yield is stated."
      },
      confidence: { type: "string", enum: ["high", "medium", "low"], description: "Confidence level in this suggestion" }
    },
    required: ["name", "effortGuess", "notes", "recipeText", "ingredients", "servings", "confidence"]
  }
};

function parseSuggestion(input: unknown): MealSuggestion {
  if (!input || typeof input !== "object") throw new Error("Anthropic returned unexpected response format.");
  const raw = input as Record<string, unknown>;
  const effortRaw = typeof raw.effortGuess === "string" ? raw.effortGuess : "easy";
  const effortValues = ["quick", "easy", "medium", "high_effort"] as const;
  const effortGuess: MealSuggestion["effortGuess"] = (effortValues as readonly string[]).includes(effortRaw)
    ? (effortRaw as MealSuggestion["effortGuess"])
    : "easy";
  const confidenceRaw = raw.confidence;
  const confidence: MealSuggestion["confidence"] =
    confidenceRaw === "high" || confidenceRaw === "medium" || confidenceRaw === "low" ? confidenceRaw : "low";
  return {
    name: typeof raw.name === "string" ? raw.name.trim() : "",
    effortGuess,
    notes: typeof raw.notes === "string" ? raw.notes.trim() : "",
    recipeText: typeof raw.recipeText === "string" ? raw.recipeText.trim() : "",
    ingredients: coerceIngredients(raw.ingredients),
    servings: typeof raw.servings === "string" ? raw.servings.trim() : "",
    confidence
  };
}

// Tolerate older tool-use responses (and tests) that pre-date Round 10
// by treating a missing `ingredients` as an empty array. Drops non-string
// entries and trims whitespace; empty strings are filtered out so the
// checklist never renders bullet-less rows.
function coerceIngredients(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (trimmed) out.push(trimmed);
  }
  return out;
}

export async function suggestMealFromImage(
  imageBase64: string,
  mediaType: string,
  system: MeasurementSystem = "metric"
): Promise<MealSuggestion> {
  const client = getAnthropicClient();
  const response = await client.messages.create(
    {
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      tools: [suggestMealTool],
      tool_choice: { type: "tool", name: "suggest_meal" },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType as SupportedMediaType, data: imageBase64 } },
            { type: "text", text: `${SUGGEST_FROM_IMAGE_PROMPT}${unitsDirective(system)}` }
          ]
        }
      ]
    },
    { signal: AbortSignal.timeout(FALLBACK_TIMEOUT_MS) }
  );

  recordAiTokens({
    model: "claude-sonnet-4-6",
    provider: "anthropic",
    operation: "suggest_meal_from_image",
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") throw new Error("Anthropic did not return a suggestion.");
  return parseSuggestion(toolBlock.input);
}

export async function suggestMealFromText(
  text: string,
  system: MeasurementSystem = "metric"
): Promise<MealSuggestion> {
  const client = getAnthropicClient();
  const response = await client.messages.create(
    {
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      tools: [suggestMealTool],
      tool_choice: { type: "tool", name: "suggest_meal" },
      messages: [{ role: "user", content: `${SUGGEST_FROM_TEXT_PROMPT}${unitsDirective(system)}\n\n${text}` }]
    },
    { signal: AbortSignal.timeout(FALLBACK_TIMEOUT_MS) }
  );

  recordAiTokens({
    model: "claude-sonnet-4-6",
    provider: "anthropic",
    operation: "suggest_meal_from_text",
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") throw new Error("Anthropic did not return a suggestion.");
  return parseSuggestion(toolBlock.input);
}

export async function suggestMealFromVoiceTranscript(
  transcript: string,
  system: MeasurementSystem = "metric"
): Promise<MealSuggestion> {
  const client = getAnthropicClient();
  const response = await client.messages.create(
    {
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      tools: [suggestMealTool],
      tool_choice: { type: "tool", name: "suggest_meal" },
      messages: [
        { role: "user", content: `${SUGGEST_FROM_VOICE_NOTE_PROMPT}${unitsDirective(system)}\n\n${transcript}` }
      ]
    },
    { signal: AbortSignal.timeout(FALLBACK_TIMEOUT_MS) }
  );

  recordAiTokens({
    model: "claude-sonnet-4-6",
    provider: "anthropic",
    operation: "suggest_meal_from_voice",
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("Anthropic did not return a suggestion.");
  }
  return parseSuggestion(toolBlock.input);
}

/**
 * Round 10 — ingredient-only extraction for legacy meals. Tool-use
 * forces a typed response so we don't parse free-form JSON out of
 * prose; the tool's only field is `ingredients`, which gives the
 * model a hard contract.
 */
const extractIngredientsTool = {
  name: "extract_ingredients",
  description: "Return the ordered ingredient list from a recipe.",
  input_schema: {
    type: "object" as const,
    properties: {
      ingredients: {
        type: "array",
        items: { type: "string" },
        description:
          "Ordered ingredient lines as they appear in the recipe ('1 cup basmati rice'). Empty array if no ingredients are listed."
      }
    },
    required: ["ingredients"]
  }
};

export async function extractIngredientsFromText(recipeText: string): Promise<string[]> {
  const client = getAnthropicClient();
  const response = await client.messages.create(
    {
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      tools: [extractIngredientsTool],
      tool_choice: { type: "tool", name: "extract_ingredients" },
      messages: [
        { role: "user", content: `${EXTRACT_INGREDIENTS_FROM_TEXT_PROMPT}\n\n${recipeText}` }
      ]
    },
    { signal: AbortSignal.timeout(FALLBACK_TIMEOUT_MS) }
  );

  recordAiTokens({
    model: "claude-sonnet-4-6",
    provider: "anthropic",
    operation: "extract_ingredients_from_text",
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("Anthropic did not return an ingredient list.");
  }
  const input = toolBlock.input as { ingredients?: unknown };
  return coerceIngredients(input.ingredients);
}

export async function generateShareText(
  mealName: string,
  recipeText: string,
  notes: string | null | undefined,
  householdName?: string | null
): Promise<{ text: string }> {
  const client = getAnthropicClient();
  const response = await client.messages.create(
    {
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system:
        "You write friendly, plain-text recipe messages for sharing on WhatsApp or iMessage. No markdown, no asterisks, no dashes, no formatting symbols of any kind — just plain text and line breaks.",
      messages: [
        { role: "user", content: buildSharePrompt(mealName, recipeText, notes, householdName) }
      ]
    },
    { signal: AbortSignal.timeout(FALLBACK_TIMEOUT_MS) }
  );

  recordAiTokens({
    model: "claude-sonnet-4-6",
    provider: "anthropic",
    operation: "generate_share_text",
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Anthropic did not generate share text.");
  return { text: textBlock.text.trim() };
}

/**
 * Round 18 — refine a recipe against a user instruction. Fallback path
 * mirrors OpenAI's behaviour: same prompt + same response schema. The
 * model is asked to emit raw JSON; Zod validates on the way out.
 *
 * Photo refinement is handled here when this provider is selected —
 * Anthropic accepts image blocks the same way OpenAI's vision API does.
 */
export async function proposeRefineChanges(args: {
  recipeJson: string;
  instruction: string;
  image?: { base64: string; mediaType: string };
  system?: MeasurementSystem;
}): Promise<ProposeChangesResponse> {
  const client = getAnthropicClient();
  const userBlocks: Array<
    | { type: "image"; source: { type: "base64"; media_type: SupportedMediaType; data: string } }
    | { type: "text"; text: string }
  > = [];
  if (args.image) {
    userBlocks.push({
      type: "image",
      source: {
        type: "base64",
        media_type: args.image.mediaType as SupportedMediaType,
        data: args.image.base64
      }
    });
  }
  userBlocks.push({
    type: "text",
    text: `Current recipe (JSON):\n${args.recipeJson}\n\nUser instruction:\n${args.instruction}\n\nReturn ONLY the JSON object described above.`
  });

  const response = await client.messages.create(
    {
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: `${REFINE_RECIPE_PROMPT}${unitsDirective(args.system ?? "metric")}`,
      messages: [{ role: "user", content: userBlocks }]
    },
    { signal: AbortSignal.timeout(REFINE_FALLBACK_TIMEOUT_MS) }
  );

  recordAiTokens({
    model: "claude-sonnet-4-6",
    provider: "anthropic",
    operation: "refine_propose_changes",
    input_tokens: response.usage.input_tokens,
    output_tokens: response.usage.output_tokens
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Anthropic did not return a refinement.");
  }
  return proposeChangesResponseSchema.parse(JSON.parse(textBlock.text));
}
