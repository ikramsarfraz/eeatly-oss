import "server-only";

import { getServerEnv } from "@/lib/env/server";
import { buildDishImagePrompt } from "@/lib/ai/prompts";
import { logger } from "@/lib/observability/logger";

/**
 * Google Gemini image generation via the REST API (no SDK dependency — a
 * single generateContent call is all we need). Gemini 2.5 Flash Image
 * ("Nano Banana") is the primary dish-image provider: a flat ~$0.039/image
 * with no quality-tier cost cliff, versus gpt-image-1's variable $0.04–0.17.
 *
 * Returns raw base64 (PNG/JPEG) so the caller uploads the bytes straight to
 * R2. Throws on any failure so the dish-image service can fall back to
 * gpt-image-1 (see services/dish-images.ts).
 */

export const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";
const IMAGE_TIMEOUT_MS = 30_000;

/** Whether Gemini is configured (used to decide primary vs. fallback). */
export function hasGeminiKey(): boolean {
  return Boolean(getServerEnv().GEMINI_API_KEY);
}

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> };
  }>;
};

export async function generateDishImage(dishName: string): Promise<{ base64: string }> {
  const { GEMINI_API_KEY } = getServerEnv();
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not configured.");

  const start = Date.now();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildDishImagePrompt(dishName) }] }],
        generationConfig: { responseModalities: ["IMAGE"] }
      }),
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS)
    }
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini image generation failed (${res.status}): ${detail.slice(0, 200)}`);
  }

  const json = (await res.json()) as GeminiResponse;
  const parts = json.candidates?.[0]?.content?.parts ?? [];
  const base64 = parts.find((p) => p.inlineData?.data)?.inlineData?.data;
  if (!base64) throw new Error("Gemini returned no image data.");

  logger.info("ai_provider_call", {
    provider: "gemini",
    operation: "generate_dish_image",
    success: true,
    latencyMs: Date.now() - start
  });

  return { base64 };
}
