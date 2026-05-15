import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { users } from "./auth";

export const householdMemberRoleEnum = pgEnum("household_member_role", [
  "owner",
  "member"
]);

export const households = pgTable("households", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  // Owner is also a row in household_members; this column is the canonical
  // owner pointer for fast lookup + invariant enforcement (the row in
  // household_members can drift via misuse, this is the truth).
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const householdMembers = pgTable(
  "household_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: householdMemberRoleEnum("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    householdUserUnique: uniqueIndex("household_members_household_user_unique").on(
      table.householdId,
      table.userId
    ),
    // One household per user — this column-level unique enforces the
    // round-4 invariant ("each user is in exactly ONE household at a time")
    // at the DB layer. Trying to insert a second membership row throws.
    userUnique: uniqueIndex("household_members_user_unique").on(table.userId)
  })
);

export const householdInvitations = pgTable(
  "household_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id, { onDelete: "cascade" }),
    // Stored lowercased — call sites lowercase before insert. Lookups also
    // lowercase. Avoids a citext extension dependency.
    email: text("email").notNull(),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Generated server-side via crypto.randomBytes(32).toString('base64url').
    // Treated as a bearer secret; never logged.
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    tokenIdx: index("household_invitations_token_idx").on(table.token),
    // Pending-invites listing per household: scan by (householdId,
    // acceptedAt IS NULL). The composite index supports both ordered
    // listing and the dedup checks in createInvitationAction.
    householdAcceptedIdx: index("household_invitations_household_accepted_idx").on(
      table.householdId,
      table.acceptedAt
    )
  })
);

export type Household = typeof households.$inferSelect;
export type NewHousehold = typeof households.$inferInsert;
export type HouseholdMember = typeof householdMembers.$inferSelect;
export type HouseholdInvitation = typeof householdInvitations.$inferSelect;
