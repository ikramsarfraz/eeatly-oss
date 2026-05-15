import { relations } from "drizzle-orm";
import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./auth";

export const feedbackTypeEnum = pgEnum("feedback_type", [
  "bug",
  "confusion",
  "feature_request",
  "general"
]);

export const betaFeedback = pgTable(
  "beta_feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: feedbackTypeEnum("type").notNull(),
    message: text("message").notNull(),
    context: text("context"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    userCreatedAtIdx: index("beta_feedback_user_created_at_idx").on(
      table.userId,
      table.createdAt
    ),
    typeCreatedAtIdx: index("beta_feedback_type_created_at_idx").on(
      table.type,
      table.createdAt
    )
  })
);

export const betaFeedbackRelations = relations(betaFeedback, ({ one }) => ({
  user: one(users, {
    fields: [betaFeedback.userId],
    references: [users.id]
  })
}));
