import "server-only";

import OpenAI, { toFile } from "openai";
import {
  buildSharePrompt,
  EXTRACT_INGREDIENTS_FROM_TEXT_PROMPT,
  SUGGEST_FROM_IMAGE_PROMPT,
  SUGGEST_FROM_TEXT_PROMPT,
  SUGGEST_FROM_VOICE_NOTE_PROMPT,
  SUGGEST_FROM_YOUTUBE_PROMPT
} from "@/lib/ai/prompts";
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

// Primary timeout shorter than the fallback (15s on Anthropic). When OpenAI
// is degraded, we'd rather fail over fast than make users sit through the
// full 15s before withFallback fires — worst-case perceived latency drops
// from ~30s to ~22s. Anthropic's longer budget reflects that it's the
// last line; we'd rather wait for an answer than show "both providers
// down" for a transient blip.
const PRIMARY_TIMEOUT_MS = 7_000;

// Strict JSON-schema mode on OpenAI requires every property in `properties`
// to also be listed in `required`. We instruct the model in the prompt to
// return an empty array when no ingredients are present rather than omit
// the field — keeps the wire contract simple and strict-compatible.
const SUGGESTION_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    effortGuess: { type: "string", enum: ["quick", "easy", "medium", "high_effort"] },
    notes: { type: "string" },
    recipeText: { type: "string" },
    ingredients: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["high", "medium", "low"] }
  },
  required: ["name", "effortGuess", "notes", "recipeText", "ingredients", "confidence"],
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
    ingredients: coerceIngredients(raw.ingredients),
    confidence
  };
}

// Backward-compat: pre-Round-10 fixtures and any model that ignored the
// ingredients instruction land in `coerceIngredients` and become `[]`
// rather than `undefined`, so callers (and the type contract) can rely
// on a concrete array.
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
    { signal: AbortSignal.timeout(PRIMARY_TIMEOUT_MS) }
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
    { signal: AbortSignal.timeout(PRIMARY_TIMEOUT_MS) }
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

export async function suggestMealFromTranscript(transcript: string): Promise<MealSuggestion> {
  const client = getClient();
  // YouTube transcripts can be long. The model has its own input cap;
  // services/ai.ts:suggestMealFromYouTubeUrl truncates before calling
  // this. Bigger output budget than the text path — transcript recipes
  // tend to be wordier (ingredients spread across the talk track).
  const response = await client.chat.completions.create(
    {
      model: MODEL,
      max_tokens: 1500,
      response_format: {
        type: "json_schema",
        json_schema: { name: "meal_suggestion", strict: true, schema: SUGGESTION_SCHEMA }
      },
      messages: [
        { role: "user", content: `${SUGGEST_FROM_YOUTUBE_PROMPT}\n\n${transcript}` }
      ]
    },
    { signal: AbortSignal.timeout(PRIMARY_TIMEOUT_MS) }
  );

  const usage = response.usage;
  logger.info("ai_provider_tokens", {
    provider: "openai",
    operation: "suggest_meal_from_youtube",
    input_tokens: usage?.prompt_tokens ?? null,
    output_tokens: usage?.completion_tokens ?? null
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response.");
  return parseSuggestion(JSON.parse(content) as Record<string, unknown>);
}

export async function suggestMealFromVoiceTranscript(
  transcript: string
): Promise<MealSuggestion> {
  const client = getClient();
  // Voice notes typically run shorter than YouTube transcripts but
  // wordier than pasted text — ramble, corrections, asides. Same
  // output budget as YouTube; the prompt is responsible for compressing
  // filler back out.
  const response = await client.chat.completions.create(
    {
      model: MODEL,
      max_tokens: 1500,
      response_format: {
        type: "json_schema",
        json_schema: { name: "meal_suggestion", strict: true, schema: SUGGESTION_SCHEMA }
      },
      messages: [
        { role: "user", content: `${SUGGEST_FROM_VOICE_NOTE_PROMPT}\n\n${transcript}` }
      ]
    },
    { signal: AbortSignal.timeout(PRIMARY_TIMEOUT_MS) }
  );

  const usage = response.usage;
  logger.info("ai_provider_tokens", {
    provider: "openai",
    operation: "suggest_meal_from_voice",
    input_tokens: usage?.prompt_tokens ?? null,
    output_tokens: usage?.completion_tokens ?? null
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response.");
  return parseSuggestion(JSON.parse(content) as Record<string, unknown>);
}

/**
 * Round 10 — ingredient-only extraction for legacy meals. Cheaper
 * call shape than the full suggest schema: one field, no enums. Reuses
 * the strict JSON-schema response_format so we get a deterministic
 * `{ ingredients: string[] }` back without parsing prose.
 */
const INGREDIENTS_SCHEMA = {
  type: "object",
  properties: {
    ingredients: { type: "array", items: { type: "string" } }
  },
  required: ["ingredients"],
  additionalProperties: false
} as const;

export async function extractIngredientsFromText(recipeText: string): Promise<string[]> {
  const client = getClient();
  const response = await client.chat.completions.create(
    {
      model: MODEL,
      max_tokens: 800,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ingredient_extraction",
          strict: true,
          schema: INGREDIENTS_SCHEMA
        }
      },
      messages: [
        { role: "user", content: `${EXTRACT_INGREDIENTS_FROM_TEXT_PROMPT}\n\n${recipeText}` }
      ]
    },
    { signal: AbortSignal.timeout(PRIMARY_TIMEOUT_MS) }
  );

  const usage = response.usage;
  logger.info("ai_provider_tokens", {
    provider: "openai",
    operation: "extract_ingredients_from_text",
    input_tokens: usage?.prompt_tokens ?? null,
    output_tokens: usage?.completion_tokens ?? null
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response.");
  const parsed = JSON.parse(content) as { ingredients?: unknown };
  return coerceIngredients(parsed.ingredients);
}

// Whisper-specific timeout — Whisper is materially slower than chat
// completions (10–20s on long voice notes is normal). The 7s primary
// budget the other paths use would time out essentially every call.
const WHISPER_TIMEOUT_MS = 30_000;

/**
 * Round 8 — Whisper transcription. Returns the raw transcript text;
 * caller is responsible for feeding it to the extraction prompt.
 *
 * Whisper auto-detects language (no `language` param) — it handles
 * Urdu/Hindi/English code-switching well, which is the primary use
 * case for our audience.
 *
 * Whisper is the only transcription provider — no Anthropic fallback
 * for v1 (different model class, complicates the contract). If
 * Whisper is down, the service throws `AudioTranscriptionFailedError`.
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  mediaType: string,
  fileName: string
): Promise<string> {
  const client = getClient();
  const file = await toFile(audioBuffer, fileName, { type: mediaType });
  const start = Date.now();
  const response = await client.audio.transcriptions.create(
    {
      file,
      model: "whisper-1",
      response_format: "json"
    },
    { signal: AbortSignal.timeout(WHISPER_TIMEOUT_MS) }
  );
  logger.info("ai_provider_call", {
    provider: "openai",
    operation: "transcribe_audio",
    success: true,
    latencyMs: Date.now() - start
  });
  // `response_format: 'json'` narrows the typed response to
  // `Transcription` — the `text` field is always present.
  return (response as { text: string }).text;
}

export async function generateShareText(
  mealName: string,
  recipeText: string,
  notes: string | null | undefined,
  householdName?: string | null
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
        { role: "user", content: buildSharePrompt(mealName, recipeText, notes, householdName) }
      ]
    },
    { signal: AbortSignal.timeout(PRIMARY_TIMEOUT_MS) }
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
