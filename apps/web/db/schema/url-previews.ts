import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Round 16 — server-side cache for URL previews (OG metadata).
 *
 * One row per canonical URL. The URL itself is the primary key — short
 * enough (we cap at 2048 chars upstream) to use directly, simple to
 * reason about, and avoids the overhead of a synthetic id + unique
 * index pair when the natural key is unique by construction.
 *
 * Failures are cached too (`errorCode` set, other fields null) on a
 * shorter TTL than successes — re-rendering the recipe view repeatedly
 * shouldn't re-hammer a 404-ing site, but a transient outage shouldn't
 * lock us into "no preview" for a week either. TTL is computed at read
 * time from `fetchedAt`; the schema doesn't carry a "valid until"
 * column so we can adjust the policy in code without a migration.
 */
export const urlPreviews = pgTable(
  "url_previews",
  {
    url: text("url").primaryKey(),
    title: text("title"),
    description: text("description"),
    imageUrl: text("image_url"),
    hostName: text("host_name").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
    errorCode: text("error_code")
  },
  (table) => ({
    fetchedAtIdx: index("url_previews_fetched_at_idx").on(table.fetchedAt)
  })
);

export type UrlPreviewRow = typeof urlPreviews.$inferSelect;
