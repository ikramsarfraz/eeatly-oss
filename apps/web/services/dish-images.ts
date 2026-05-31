import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dishImages } from "@/db/schema";
import * as openai from "@/lib/ai/providers/openai";
import { uploadDishImage } from "@/lib/storage/r2";
import { hasR2Env } from "@/lib/env/server";
import { normalizeMealName } from "@/lib/utils";
import { logger } from "@/lib/observability/logger";

/**
 * App-wide AI dish-image cache.
 *
 * Surface:
 *   - `getDishImage(name)` — read-only cache lookup; never generates.
 *   - `generateDishImageForName(name)` — cache-first; on miss, generate via
 *     OpenAI, upload to R2, persist, and return the URL.
 *
 * The cache key is the *normalized* dish name (same normalization the
 * `meals` table uses), so an image is generated once and shared across every
 * household cooking the same dish — cost is bounded by distinct dish count.
 *
 * Caching policy (TTL computed at read time from `generatedAt`):
 *   - `ready` rows are effectively permanent.
 *   - `failed` rows live 1 hour, so a transient OpenAI/R2 outage retries
 *     soon while a hot recipe view doesn't re-hammer the provider.
 *
 * The model returns base64 PNG bytes; we hold them only long enough to PUT
 * to R2 (no temp file, no presign round-trip — see lib/storage/r2.ts).
 */

const MODEL = "gpt-image-1";
const FAILURE_TTL_MS = 60 * 60 * 1000;
const IMAGE_CONTENT_TYPE = "image/png";

/**
 * Read-only lookup. Returns the shared image URL when a `ready` row exists,
 * otherwise null (missing, failed, or expired-failure). Used by callers that
 * want the cached value without paying to generate one.
 */
export async function getDishImage(name: string): Promise<string | null> {
  const normalizedName = normalizeMealName(name);
  if (!normalizedName) return null;

  const [row] = await db
    .select()
    .from(dishImages)
    .where(eq(dishImages.normalizedName, normalizedName))
    .limit(1);

  if (!row) return null;
  if (row.status === "ready" && row.imageUrl) return row.imageUrl;
  return null;
}

/**
 * Cache-first generation. The hot path (image already generated for this
 * dish, by any user) is a single indexed read and costs nothing. Only the
 * first viewer of a never-seen dish pays for the OpenAI + R2 round-trip.
 *
 * Returns null (degrade to the monogram tile) when:
 *   - the dish name normalizes to empty,
 *   - R2 isn't configured,
 *   - a recent failure is still within its TTL,
 *   - generation/upload throws (the failure is cached on the way out).
 */
export async function generateDishImageForName(name: string): Promise<string | null> {
  const normalizedName = normalizeMealName(name);
  if (!normalizedName) return null;

  // Without R2 we can't persist the bytes anywhere durable — skip the
  // (paid) generation entirely and let the UI fall back to the monogram.
  if (!hasR2Env()) return null;

  const [row] = await db
    .select()
    .from(dishImages)
    .where(eq(dishImages.normalizedName, normalizedName))
    .limit(1);

  if (row) {
    if (row.status === "ready" && row.imageUrl) return row.imageUrl;
    if (row.status === "failed") {
      const age = Date.now() - row.generatedAt.getTime();
      if (age < FAILURE_TTL_MS) return null; // back off; retry after the TTL
    }
  }

  try {
    const { base64 } = await openai.generateDishImage(normalizedName);
    const bytes = Buffer.from(base64, "base64");
    const imageUrl = await uploadDishImage(normalizedName, bytes, IMAGE_CONTENT_TYPE);

    await db
      .insert(dishImages)
      .values({
        normalizedName,
        imageUrl,
        status: "ready",
        errorCode: null,
        model: MODEL,
        generatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: dishImages.normalizedName,
        set: {
          imageUrl,
          status: "ready",
          errorCode: null,
          model: MODEL,
          generatedAt: new Date()
        }
      });

    return imageUrl;
  } catch (error) {
    logger.warn("dish_image_generation_failed", {
      normalizedName,
      error: error instanceof Error ? error.message : String(error)
    });
    await db
      .insert(dishImages)
      .values({
        normalizedName,
        imageUrl: null,
        status: "failed",
        errorCode: "GENERATION_FAILED",
        model: MODEL,
        generatedAt: new Date()
      })
      .onConflictDoUpdate({
        target: dishImages.normalizedName,
        set: {
          imageUrl: null,
          status: "failed",
          errorCode: "GENERATION_FAILED",
          generatedAt: new Date()
        }
      });
    return null;
  }
}
