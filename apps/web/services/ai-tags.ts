import "server-only";

import OpenAI from "openai";
import { getServerEnv } from "@/lib/env/server";
import { logger } from "@/lib/observability/logger";
import {
  CUISINE_OPTIONS,
  COURSE_OPTIONS,
  MAIN_OPTIONS,
  DIET_OPTIONS,
  OCCASION_OPTIONS,
  type MealTags
} from "@/lib/meals/tags";
import { heuristicTags } from "@/lib/meals/tag-heuristic";

/**
 * R36 — AI recipe tagger. Returns the five facets for a dish. Uses OpenAI
 * (json-schema mode) when available and falls back to a keyword heuristic on
 * ANY failure (no key, timeout, parse error) so tagging never blocks capture or
 * the backfill and the Library filters always have data to work with. Single-
 * select facets come back as strings ("" = unknown → null); Diet + Occasion are
 * arrays.
 */

const MODEL = "gpt-4o-mini";

const TAG_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["cuisine", "course", "mainIngredient", "diet", "occasion"],
  properties: {
    cuisine: { type: "string", description: `One cuisine, e.g. ${CUISINE_OPTIONS.slice(0, 8).join(", ")}. "" if unsure.` },
    course: { type: "string", description: `One course, e.g. ${COURSE_OPTIONS.join(", ")}.` },
    mainIngredient: { type: "string", description: `The main protein/base: ${MAIN_OPTIONS.join(", ")}.` },
    diet: { type: "array", items: { type: "string" }, description: `0-3 of: ${DIET_OPTIONS.join(", ")}.` },
    occasion: { type: "array", items: { type: "string" }, description: `0-2 of: ${OCCASION_OPTIONS.join(", ")}.` }
  }
} as const;

function clean(value: unknown): string | null {
  const s = typeof value === "string" ? value.trim() : "";
  return s.length > 0 ? s : null;
}
function cleanArray(value: unknown, allowed: string[]): string[] {
  if (!Array.isArray(value)) return [];
  const lower = new Map(allowed.map((a) => [a.toLowerCase(), a]));
  const out: string[] = [];
  for (const v of value) {
    const match = typeof v === "string" ? lower.get(v.trim().toLowerCase()) : undefined;
    if (match && !out.includes(match)) out.push(match);
  }
  return out;
}

export async function generateMealTags(input: {
  name: string;
  recipeText?: string | null;
  ingredients?: string[] | null;
}): Promise<{ tags: MealTags; source: "ai" | "heuristic" }> {
  try {
    const apiKey = getServerEnv().OPENAI_API_KEY;
    if (!apiKey) throw new Error("No OpenAI key.");
    const client = new OpenAI({ apiKey });

    const context = [
      `Dish: ${input.name}`,
      input.ingredients?.length ? `Ingredients: ${input.ingredients.slice(0, 30).join(", ")}` : "",
      input.recipeText ? `Recipe: ${input.recipeText.slice(0, 1200)}` : ""
    ]
      .filter(Boolean)
      .join("\n");

    const response = await client.chat.completions.create(
      {
        model: MODEL,
        max_tokens: 200,
        response_format: {
          type: "json_schema",
          json_schema: { name: "meal_tags", strict: true, schema: TAG_SCHEMA }
        },
        messages: [
          {
            role: "system",
            content:
              "You tag home-cooked recipes for a cooking app. Pick the single best cuisine, course, and main ingredient, plus any clearly-applicable diet and occasion tags. Prefer the suggested vocab but a close synonym is fine. Use \"\" / [] when unsure rather than guessing."
          },
          { role: "user", content: context }
        ]
      },
      { timeout: 8000 }
    );

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty tag response.");
    const raw = JSON.parse(content) as Record<string, unknown>;
    return {
      tags: {
        cuisine: clean(raw.cuisine),
        course: clean(raw.course),
        mainIngredient: clean(raw.mainIngredient),
        diet: cleanArray(raw.diet, DIET_OPTIONS),
        occasion: cleanArray(raw.occasion, OCCASION_OPTIONS)
      },
      source: "ai"
    };
  } catch (error) {
    logger.warn("ai_tag_fallback_heuristic", {
      name: input.name,
      error: error instanceof Error ? error.message : String(error)
    });
    return { tags: heuristicTags(input.name), source: "heuristic" };
  }
}
