-- =============================================================================
-- 0029_dish_images.sql — App-wide AI-generated dish image cache
-- =============================================================================
-- Cache of AI-generated dish images, keyed by *normalized dish name* (the
-- same normalization `meals.normalized_name` uses — trim + collapse
-- whitespace + lowercase). One row per distinct dish, shared across every
-- household, so an image is generated once app-wide rather than per account.
-- Cost is therefore bounded by the number of distinct dishes.
--
-- `image_url` points at the R2 object (public URL). A user's own photo on
-- `meals.photo_url` always wins; reads coalesce
-- `coalesce(meals.photo_url, dish_images.image_url)`, so this table is only
-- the fallback for meals with no photo of their own.
--
-- `status` is 'ready' (image_url populated) or 'failed' (image_url null,
-- error_code set). TTL is computed at read time from `generated_at`:
-- successes are effectively permanent, failures expire after ~1 hour so a
-- transient OpenAI/R2 blip doesn't lock a dish out, while repeated recipe
-- views don't re-hammer the provider.
--
-- The `generated_at` index supports a future "stale failures" cleanup job;
-- not exercised by the service today.
--
-- Rollback:
--   DROP INDEX IF EXISTS "dish_images_generated_at_idx";
--   DROP TABLE IF EXISTS "dish_images";
-- =============================================================================

CREATE TABLE IF NOT EXISTS "dish_images" (
  "normalized_name" text PRIMARY KEY NOT NULL,
  "image_url" text,
  "status" text NOT NULL,
  "error_code" text,
  "model" text,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "dish_images_generated_at_idx" ON "dish_images" ("generated_at");
