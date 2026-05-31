import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from "drizzle-orm/pg-core";
import { users } from "./auth";

/**
 * Per-user global sharing & privacy settings (Settings → Sharing & privacy).
 * One row per user; absent row = all defaults. Every field is enforced
 * server-side (see services/user-settings.ts consumers), not just cosmetic.
 *   - allow_link_shares: gates creating "anyone with the link" shares.
 *   - cooks_can_reshare: lets people you've shared an item with re-share it.
 *   - who_can_add_you: 'anyone' | 'connections' | 'no_one' — gates inbound
 *     connection invites for existing users.
 *   - find_by_email: whether others can discover/auto-match you by email.
 *   - measurement_system: 'metric' | 'imperial' — the cook's preferred
 *     units. Inferred once at signup from the request's geo/locale (see
 *     lib/units/detect.ts) and flippable in Settings → Kitchen. Biases the
 *     AI on capture + Refine so new recipe quantities come out in the
 *     user's system; existing free-form quantity strings are left verbatim.
 */
export const userSettings = pgTable("user_settings", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  allowLinkShares: boolean("allow_link_shares").notNull().default(true),
  cooksCanReshare: boolean("cooks_can_reshare").notNull().default(false),
  whoCanAddYou: text("who_can_add_you").notNull().default("connections"),
  findByEmail: boolean("find_by_email").notNull().default(true),
  measurementSystem: text("measurement_system").notNull().default("metric"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export type UserSettingsRow = typeof userSettings.$inferSelect;

/**
 * Per-item sharing model ("Yours / Shared with you") — the engine.
 *
 * Replaces the household "one shared kitchen" visibility with a
 * Google-Drive-style model layered on top of the existing per-user
 * workspace (each user's auto-created solo household is their private
 * library). Nothing here removes households; ownership of an item is the
 * item's `created_by_user_id`, and these tables add explicit, per-person
 * access on top.
 *
 * Item types are polymorphic over the two shareable surfaces:
 *   - 'recipe' → a row in `meals`
 *   - 'plan'   → a row in `plans`
 * `item_id` is intentionally NOT a FK (it points at one of two tables);
 * referential cleanup on item delete is handled in the service layer,
 * which also writes a tombstone so the recipient learns the item is gone.
 */

// item_type discriminator used across these tables:
//   'recipe' → meals.id   ·   'plan' → plans.id

/**
 * A live, read-only grant of one item to one person. Creating a grant is
 * how an owner shares; the grantee then sees a live copy under "Shared
 * with you". Soft-revoked via `revoked_at` (which also spawns a
 * tombstone). `saved_copy_item_id` records that the grantee forked the
 * item into their own library (dedup: never re-fork the same grant).
 */
export const itemGrants = pgTable(
  "item_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    itemType: text("item_type").notNull(),
    itemId: uuid("item_id").notNull(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    granteeUserId: text("grantee_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // The grantee's forked copy, if they saved one. Points at a new
    // `meals`/`plans` row they own; null until they save a copy.
    savedCopyItemId: uuid("saved_copy_item_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true })
  },
  (table) => ({
    // One grant per (item, person). Re-granting after a revoke reuses the
    // row (un-revoke) rather than inserting a duplicate.
    itemGranteeIdx: uniqueIndex("item_grants_item_grantee_idx").on(
      table.itemType,
      table.itemId,
      table.granteeUserId
    ),
    // "Shared with me" — grantee's inbound grants.
    granteeIdx: index("item_grants_grantee_idx").on(table.granteeUserId, table.revokedAt),
    // "Who can see this item" — owner-side enumeration.
    itemIdx: index("item_grants_item_idx").on(table.itemType, table.itemId, table.revokedAt)
  })
);

export type ItemGrantRow = typeof itemGrants.$inferSelect;

/**
 * A recipient asking an owner to share a specific (locked) item — e.g. a
 * co-cook on a shared plan requesting a dish whose recipe wasn't shared.
 * Resolves to 'granted' (owner shares it) or 'declined'.
 */
export const itemRequests = pgTable(
  "item_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    itemType: text("item_type").notNull(),
    itemId: uuid("item_id").notNull(),
    requesterUserId: text("requester_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // 'pending' | 'granted' | 'declined'
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true })
  },
  (table) => ({
    // One open request per (item, requester) — a partial unique index so
    // resolved requests don't block a future re-request.
    pendingIdx: uniqueIndex("item_requests_pending_idx")
      .on(table.itemType, table.itemId, table.requesterUserId)
      .where(sql`status = 'pending'`),
    ownerIdx: index("item_requests_owner_idx").on(table.ownerUserId, table.status)
  })
);

export type ItemRequestRow = typeof itemRequests.$inferSelect;

/**
 * Recipient-side record that a live copy went away — surfaced as a
 * "Recently removed" strip. Written when an owner revokes a grant
 * (kind 'revoked') or deletes a shared item (kind 'deleted'). The item
 * name + owner name are snapshotted because the underlying item may be
 * gone. A saved copy the grantee made is unaffected and recorded here so
 * the UI can offer "Open my copy".
 */
export const shareTombstones = pgTable(
  "share_tombstones",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    granteeUserId: text("grantee_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    itemType: text("item_type").notNull(),
    itemName: text("item_name").notNull(),
    ownerUserId: text("owner_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    ownerName: text("owner_name"),
    kind: text("kind").notNull(), // 'revoked' | 'deleted'
    savedCopyItemId: uuid("saved_copy_item_id"),
    dismissedAt: timestamp("dismissed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    granteeIdx: index("share_tombstones_grantee_idx").on(
      table.granteeUserId,
      table.dismissedAt,
      table.createdAt
    )
  })
);

export type ShareTombstoneRow = typeof shareTombstones.$inferSelect;

/**
 * Your sharing circle — an accepted, symmetric connection between two
 * users. Being connected grants nothing on its own (sharing is per-item);
 * it's the set of people who appear in your Share sheet and People page.
 * Stored canonically with `user_low_id < user_high_id` so the pair is
 * unique regardless of who initiated.
 */
export const connections = pgTable(
  "connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userLowId: text("user_low_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    userHighId: text("user_high_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    pairIdx: uniqueIndex("connections_pair_idx").on(table.userLowId, table.userHighId),
    lowIdx: index("connections_low_idx").on(table.userLowId),
    highIdx: index("connections_high_idx").on(table.userHighId)
  })
);

export type ConnectionRow = typeof connections.$inferSelect;

/**
 * Email invitation to join someone's sharing circle (the People page's
 * "Invite someone"). Distinct from the legacy household invitation: this
 * does NOT move the invitee between households — accepting just creates a
 * `connection`. Bearer-token model mirrors household invitations.
 */
export const connectionInvitations = pgTable(
  "connection_invitations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    inviterUserId: text("inviter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    token: text("token").notNull().unique(),
    status: text("status").notNull().default("pending"), // 'pending' | 'accepted' | 'declined'
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    tokenIdx: index("connection_invitations_token_idx").on(table.token),
    inviterIdx: index("connection_invitations_inviter_idx").on(
      table.inviterUserId,
      table.status
    )
  })
);

export type ConnectionInvitationRow = typeof connectionInvitations.$inferSelect;
