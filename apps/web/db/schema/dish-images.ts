import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * App-wide cache of AI-generated dish images.
 *
 * One row per *normalized dish name* (the same normalization the `meals`
 * table uses — trim + collapse whitespace + lowercase). The image is
 * generated once and shared across every household that cooks the same
 * dish, so cost is bounded by the number of distinct dishes rather than
 * the number of users. The normalized name is the primary key — unique
 * by construction, no synthetic id needed (mirrors `url_previews`).
 *
 * `image_url` points at the R2 object (public URL). A user's own photo
 * on `meals.photo_url` always wins; this table is only the fallback when
 * a meal has no photo of its own.
 *
 * Failures are cached too (`status = 'failed'`, `image_url` null) on a
 * short TTL computed at read time from `generated_at` — a transient
 * OpenAI/R2 blip shouldn't lock a dish out of image generation for long,
 * but it also shouldn't re-hammer the provider on every recipe view.
 * Success rows are effectively permanent.
 */
export const dishImages = pgTable(
  "dish_images",
  {
    normalizedName: text("normalized_name").primaryKey(),
    imageUrl: text("image_url"),
    status: text("status").notNull(),
    errorCode: text("error_code"),
    model: text("model"),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    generatedAtIdx: index("dish_images_generated_at_idx").on(table.generatedAt)
  })
);

export type DishImageRow = typeof dishImages.$inferSelect;
