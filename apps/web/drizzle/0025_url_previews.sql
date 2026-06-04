-- =============================================================================
-- 0025_url_previews.sql — Round 16 URL preview cache
-- =============================================================================
-- Cache of OG/Twitter-card metadata fetched server-side for arbitrary URLs
-- pasted into the `recipe_source_url` field. One row per canonical URL. The
-- URL itself is the primary key — short enough (we cap at 2048 chars
-- upstream) to use directly, and the natural key is unique by construction.
--
-- `host_name` is denormalized from the URL so the recipe view can render the
-- hostname badge without re-parsing. Failure rows have `error_code` set and
-- the other columns null; TTL is computed at read-time from `fetched_at`,
-- with successes valid for ~7 days and failures for ~1 hour.
--
-- The `fetched_at` index supports a future "stale rows" cleanup job; not
-- exercised by the procedure today.
--
-- Rollback: DROP TABLE "url_previews";
-- =============================================================================

CREATE TABLE "url_previews" (
  "url" text PRIMARY KEY NOT NULL,
  "title" text,
  "description" text,
  "image_url" text,
  "host_name" text NOT NULL,
  "fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
  "error_code" text
);

CREATE INDEX "url_previews_fetched_at_idx" ON "url_previews" ("fetched_at");
