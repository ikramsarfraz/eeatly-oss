import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

/**
 * Per-call AI token usage — the queryable record behind admin cost analysis.
 * One row per LLM provider call (the `ai_provider_tokens` log site), so COGS
 * can be computed from REAL tokens × model price rather than a flat estimate.
 * Written fire-and-forget; image generation (no token usage) and Whisper
 * (per-minute) are costed separately. `user_id` is nullable (set null on
 * account delete) and `operation` is the credit op key from the usage context.
 */
export const aiUsageEvents = pgTable(
  "ai_usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    operation: text("operation"),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    createdIdx: index("ai_usage_events_created_idx").on(table.createdAt),
    userCreatedIdx: index("ai_usage_events_user_created_idx").on(table.userId, table.createdAt)
  })
);

export type AiUsageEventRow = typeof aiUsageEvents.$inferSelect;
