import "server-only";

import OpenAI from "openai";
import { buildSharePrompt, SUGGEST_FROM_IMAGE_PROMPT, SUGGEST_FROM_TEXT_PROMPT } from "@/lib/ai/prompts";
import { logger } from "@/lib/observability/logger";
import { getServerEnv } from "@/lib/env/server";
import type { MealSuggestion } from "@/types";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: getServerEnv().OPENAI_API_KEY });
  }
  return _client;
}

const MODEL = "gpt-4o-mini";

const SUGGESTION_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    effortGuess: { type: "string", enum: ["quick", "easy", "medium", "high_effort"] },
    notes: { type: "string" },
    recipeText: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] }
  },
  required: ["name", "effortGuess", "notes", "recipeText", "confidence"],
  additionalProperties: false
} as const;

function parseSuggestion(raw: Record<string, unknown>): MealSuggestion {
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
    confidence
  };
}

export async function suggestMealFromImage(imageBase64: string, mediaType: string): Promise<MealSuggestion> {
  const client = getClient();
  const response = await client.chat.completions.create(
    {
      model: MODEL,
      max_tokens: 1024,
      response_format: {
        type: "json_schema",
        json_schema: { name: "meal_suggestion", strict: true, schema: SUGGESTION_SCHEMA }
      },
      messages: [
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mediaType};base64,${imageBase64}`, detail: "high" } },
            { type: "text", text: SUGGEST_FROM_IMAGE_PROMPT }
          ]
        }
      ]
    },
    { signal: AbortSignal.timeout(15_000) }
  );

  const usage = response.usage;
  logger.info("ai_provider_tokens", {
    provider: "openai",
    operation: "suggest_meal_from_image",
    input_tokens: usage?.prompt_tokens ?? null,
    output_tokens: usage?.completion_tokens ?? null
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response.");
  return parseSuggestion(JSON.parse(content) as Record<string, unknown>);
}

export async function suggestMealFromText(text: string): Promise<MealSuggestion> {
  const client = getClient();
  const response = await client.chat.completions.create(
    {
      model: MODEL,
      max_tokens: 1024,
      response_format: {
        type: "json_schema",
        json_schema: { name: "meal_suggestion", strict: true, schema: SUGGESTION_SCHEMA }
      },
      messages: [
        { role: "user", content: `${SUGGEST_FROM_TEXT_PROMPT}\n\n${text}` }
      ]
    },
    { signal: AbortSignal.timeout(15_000) }
  );

  const usage = response.usage;
  logger.info("ai_provider_tokens", {
    provider: "openai",
    operation: "suggest_meal_from_text",
    input_tokens: usage?.prompt_tokens ?? null,
    output_tokens: usage?.completion_tokens ?? null
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response.");
  return parseSuggestion(JSON.parse(content) as Record<string, unknown>);
}

export async function generateShareText(
  mealName: string,
  recipeText: string,
  notes: string | null | undefined
): Promise<{ text: string }> {
  const client = getClient();
  const response = await client.chat.completions.create(
    {
      model: MODEL,
      max_tokens: 600,
      messages: [
        {
          role: "system",
          content:
            "You write friendly, plain-text recipe messages for sharing on WhatsApp or iMessage. No markdown, no asterisks, no dashes, no formatting symbols of any kind — just plain text and line breaks."
        },
        { role: "user", content: buildSharePrompt(mealName, recipeText, notes) }
      ]
    },
    { signal: AbortSignal.timeout(15_000) }
  );

  const usage = response.usage;
  logger.info("ai_provider_tokens", {
    provider: "openai",
    operation: "generate_share_text",
    input_tokens: usage?.prompt_tokens ?? null,
    output_tokens: usage?.completion_tokens ?? null
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response.");
  return { text: content.trim() };
}
