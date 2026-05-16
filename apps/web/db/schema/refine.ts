import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { meals } from "./meals";
import { users } from "./auth";

/**
 * Round 18 — Refine recipe (AI-prompted editing) session tables.
 *
 * A session is a per-device draft layered on top of a meal. Turns are
 * the user's prompts; pending changes are the flattened diff across
 * accepted turns. Save commits the diff and closes the session; discard
 * marks it closed without applying. The unique constraint on
 * (meal, user, device) where status='active' enforces one in-progress
 * session per device per recipe, matching the design spec.
 *
 * JSONB columns (`proposed`, `before`, `after`, `payload`) store the
 * `PendingChange` discriminated union defined in
 * `packages/api/src/validators/refine.ts`. Shape isn't constrained at
 * the DB layer — Zod parses on the way out so any schema evolution
 * is a code change, not a migration.
 */
export const refineSessions = pgTable(
  "refine_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    mealId: uuid("meal_id")
      .notNull()
      .references(() => meals.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: text("device_id").notNull(),
    // 'active' | 'saved' | 'discarded' | 'abandoned' (future GC).
    status: text("status").notNull().default("active"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    savedAt: timestamp("saved_at", { withTimezone: true }),
    discardedAt: timestamp("discarded_at", { withTimezone: true })
  },
  (table) => ({
    // Partial unique — only enforces uniqueness while the session is
    // active. Closed sessions don't block a fresh one from starting.
    activeUnique: uniqueIndex("refine_sessions_active_unique_idx")
      .on(table.mealId, table.userId, table.deviceId)
      .where(sql`${table.status} = 'active'`),
    userMealIdx: index("refine_sessions_user_meal_idx").on(
      table.userId,
      table.mealId
    )
  })
);

export const refineTurns = pgTable(
  "refine_turns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => refineSessions.id, { onDelete: "cascade" }),
    // 0-indexed slot within the session for chat ordering.
    position: integer("position").notNull(),
    // 'text' | 'voice' | 'photo'.
    source: text("source").notNull(),
    prompt: text("prompt").notNull(),
    attachmentUrl: text("attachment_url"),
    // PendingChange[] as the AI proposed it. Source of truth even when
    // the user toggles `accepted=false`.
    proposed: jsonb("proposed").notNull(),
    accepted: boolean("accepted").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    sessionPositionUnique: uniqueIndex("refine_turns_session_position_idx").on(
      table.sessionId,
      table.position
    ),
    sessionIdx: index("refine_turns_session_idx").on(table.sessionId)
  })
);

export const refinePendingChanges = pgTable(
  "refine_pending_changes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => refineSessions.id, { onDelete: "cascade" }),
    turnId: uuid("turn_id")
      .notNull()
      .references(() => refineTurns.id, { onDelete: "cascade" }),
    // 'add' | 'change' | 'remove'.
    kind: text("kind").notNull(),
    // 'ingredient' | 'step' | 'meta'.
    target: text("target").notNull(),
    // Existing-row id for change/remove. NULL for add.
    refId: text("ref_id"),
    // For 'change': field name. NULL for add/remove.
    field: text("field"),
    before: jsonb("before"),
    after: jsonb("after"),
    payload: jsonb("payload"),
    whereHint: text("where_hint"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  (table) => ({
    sessionIdx: index("refine_pending_changes_session_idx").on(
      table.sessionId
    ),
    turnIdx: index("refine_pending_changes_turn_idx").on(table.turnId)
  })
);

export const refineSessionsRelations = relations(
  refineSessions,
  ({ many, one }) => ({
    meal: one(meals, {
      fields: [refineSessions.mealId],
      references: [meals.id]
    }),
    user: one(users, {
      fields: [refineSessions.userId],
      references: [users.id]
    }),
    turns: many(refineTurns),
    pending: many(refinePendingChanges)
  })
);

export const refineTurnsRelations = relations(refineTurns, ({ one, many }) => ({
  session: one(refineSessions, {
    fields: [refineTurns.sessionId],
    references: [refineSessions.id]
  }),
  pending: many(refinePendingChanges)
}));

export const refinePendingChangesRelations = relations(
  refinePendingChanges,
  ({ one }) => ({
    session: one(refineSessions, {
      fields: [refinePendingChanges.sessionId],
      references: [refineSessions.id]
    }),
    turn: one(refineTurns, {
      fields: [refinePendingChanges.turnId],
      references: [refineTurns.id]
    })
  })
);
