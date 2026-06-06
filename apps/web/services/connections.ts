import "server-only";

import { randomBytes } from "node:crypto";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  connectionInvitations,
  itemGrants,
  meals,
  plans,
  users
} from "@/db/schema";
import { ensureConnection, listConnections, type ItemType } from "@/services/sharing";
import { createNotification } from "@/services/notifications";
import { getUserSettings } from "@/services/user-settings";
import { listHouseholdMembers } from "@/services/households";
import { getCurrentHousehold } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env/server";
import { logger } from "@/lib/observability/logger";

/**
 * People / sharing-circle service (Phase 2).
 *
 * "People" are your connections — the set of users you can share items
 * with. Being connected grants nothing on its own. Invitations are by
 * email with a bearer token; accepting creates a `connection` (it does
 * NOT move anyone between households, unlike the legacy household invite).
 *
 * Email delivery for the invite is deferred (the transactional-email
 * subsystem is a fixed template set); for now `inviteConnection` returns a
 * copyable `/connect/<token>` link the UI surfaces.
 */

const INVITE_EXPIRES_DAYS = 14;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function inviteUrl(token: string): string {
  const base = getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}/connect/${token}`;
}

export type ItemChip = {
  itemType: ItemType;
  itemId: string;
  name: string;
};

export type PersonOverview = {
  userId: string;
  name: string | null;
  email: string;
  /** Items you've shared TO this person. */
  sharedToThem: ItemChip[];
  /** Items this person shares with you. */
  sharedToMe: ItemChip[];
};

export type PendingInvitation = {
  id: string;
  email: string;
  createdAt: string;
  expiresAt: string;
  url: string;
};

export type PeopleOverview = {
  /**
   * Household co-members. Like any connection, they only see items you've
   * explicitly shared (recipes are private by default) — they're surfaced as
   * a pinned group, with per-item chips, so you know they're in your kitchen.
   */
  kitchenMates: PersonOverview[];
  /** One-to-one connections you share individual items with. */
  people: PersonOverview[];
  pendingInvitations: PendingInvitation[];
};

/**
 * Active grants in one direction, resolved to item names. `direction`
 * 'out' = items I own and shared (key by grantee); 'in' = items shared
 * with me (key by owner). Polymorphic over recipe/plan, so two queries
 * unioned in JS.
 */
async function grantsWithNames(
  userId: string,
  direction: "out" | "in"
): Promise<Array<{ counterpartyId: string } & ItemChip>> {
  const ownerCol = itemGrants.ownerUserId;
  const granteeCol = itemGrants.granteeUserId;
  const selfCol = direction === "out" ? ownerCol : granteeCol;
  const counterpartyCol = direction === "out" ? granteeCol : ownerCol;

  const recipeRows = await db
    .select({
      counterpartyId: counterpartyCol,
      itemId: itemGrants.itemId,
      name: meals.name
    })
    .from(itemGrants)
    .innerJoin(meals, eq(meals.id, itemGrants.itemId))
    .where(
      and(
        eq(selfCol, userId),
        eq(itemGrants.itemType, "recipe"),
        isNull(itemGrants.revokedAt),
        isNull(meals.archivedAt), isNull(meals.deletedAt)
      )
    );

  const planRows = await db
    .select({
      counterpartyId: counterpartyCol,
      itemId: itemGrants.itemId,
      name: plans.name
    })
    .from(itemGrants)
    .innerJoin(plans, eq(plans.id, itemGrants.itemId))
    .where(
      and(
        eq(selfCol, userId),
        eq(itemGrants.itemType, "plan"),
        isNull(itemGrants.revokedAt),
        isNull(plans.archivedAt)
      )
    );

  return [
    ...recipeRows.map((r) => ({
      counterpartyId: r.counterpartyId,
      itemType: "recipe" as const,
      itemId: r.itemId,
      name: r.name
    })),
    ...planRows.map((r) => ({
      counterpartyId: r.counterpartyId,
      itemType: "plan" as const,
      itemId: r.itemId,
      name: r.name
    }))
  ];
}

/** Everything the People page needs: connections + both-way items + invites. */
export async function getPeopleOverview(userId: string): Promise<PeopleOverview> {
  // Resolve the household first so we can split co-members (who see the
  // whole library) out of the per-item connection list. getCurrentHousehold
  // is React-cached, so this is cheap.
  const household = await getCurrentHousehold(userId);
  const [people, outbound, inbound, pendingInvitations, members] = await Promise.all([
    listConnections(userId),
    grantsWithNames(userId, "out"),
    grantsWithNames(userId, "in"),
    listPendingInvitations(userId),
    listHouseholdMembers(userId, household.id)
  ]);
  const mateIds = new Set(
    members.map((m) => m.userId).filter((id) => id !== userId)
  );

  const byCounterparty = (rows: Array<{ counterpartyId: string } & ItemChip>) => {
    const map = new Map<string, ItemChip[]>();
    for (const r of rows) {
      const list = map.get(r.counterpartyId) ?? [];
      list.push({ itemType: r.itemType, itemId: r.itemId, name: r.name });
      map.set(r.counterpartyId, list);
    }
    return map;
  };
  const outMap = byCounterparty(outbound);
  const inMap = byCounterparty(inbound);

  const mappedPeople = people.map((p) => ({
    userId: p.userId,
    name: p.name,
    email: p.email,
    sharedToThem: outMap.get(p.userId) ?? [],
    sharedToMe: inMap.get(p.userId) ?? []
  }));

  // Pinned group is built from the membership list directly (not the
  // connection list) so co-members appear even when there's no 1:1
  // connection row. Chips come from the same grant maps — sharing with a
  // kitchen-mate is per-item, just like a connection.
  const kitchenMates: PersonOverview[] = members
    .filter((m) => m.userId !== userId)
    .map((m) => ({
      userId: m.userId,
      name: m.name,
      email: m.email,
      sharedToThem: outMap.get(m.userId) ?? [],
      sharedToMe: inMap.get(m.userId) ?? []
    }));

  return {
    kitchenMates,
    // A co-member who's also a 1:1 connection shows only under the kitchen
    // group (avoids listing the same person twice).
    people: mappedPeople.filter((p) => !mateIds.has(p.userId)),
    pendingInvitations
  };
}

/** Recipes + plans the user owns, for the "+ Share something" picker. */
export async function listOwnedShareableItems(userId: string): Promise<ItemChip[]> {
  const [recipeRows, planRows] = await Promise.all([
    db
      .select({ itemId: meals.id, name: meals.name })
      .from(meals)
      .where(and(eq(meals.createdByUserId, userId), isNull(meals.archivedAt), isNull(meals.deletedAt)))
      .orderBy(meals.name),
    db
      .select({ itemId: plans.id, name: plans.name })
      .from(plans)
      .where(and(eq(plans.createdByUserId, userId), isNull(plans.archivedAt)))
      .orderBy(plans.name)
  ]);
  return [
    ...recipeRows.map((r) => ({ itemType: "recipe" as const, itemId: r.itemId, name: r.name })),
    ...planRows.map((r) => ({ itemType: "plan" as const, itemId: r.itemId, name: r.name }))
  ];
}

export async function listPendingInvitations(userId: string): Promise<PendingInvitation[]> {
  const rows = await db
    .select()
    .from(connectionInvitations)
    .where(
      and(
        eq(connectionInvitations.inviterUserId, userId),
        eq(connectionInvitations.status, "pending"),
        gte(connectionInvitations.expiresAt, new Date())
      )
    )
    .orderBy(desc(connectionInvitations.createdAt));
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    url: inviteUrl(r.token)
  }));
}

export type InviteResult =
  | { ok: true; invitationId: string; url: string; expiresAt: string }
  | {
      ok: false;
      code: "ALREADY_CONNECTED" | "ALREADY_INVITED" | "SELF" | "BLOCKED";
      message: string;
    };

/** Invite someone (by email) into your sharing circle. */
export async function inviteConnection(userId: string, rawEmail: string): Promise<InviteResult> {
  const email = normalizeEmail(rawEmail);

  const [me] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (me && normalizeEmail(me.email) === email) {
    return { ok: false, code: "SELF", message: "That's your own email." };
  }

  // If an account exists for this email, honor that user's privacy
  // settings. `findByEmail` off makes them undiscoverable — we don't reveal
  // the account or enforce who-can-add (the email invite still sends; they
  // opt in on accept). With discovery on, enforce `whoCanAddYou`.
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existingUser) {
    const inviteeSettings = await getUserSettings(existingUser.id);
    if (inviteeSettings.findByEmail) {
      const already = (await listConnections(userId)).some((p) => p.userId === existingUser.id);
      if (already) {
        return { ok: false, code: "ALREADY_CONNECTED", message: "You're already connected." };
      }
      if (inviteeSettings.whoCanAddYou === "no_one") {
        return {
          ok: false,
          code: "BLOCKED",
          message: "This person isn't accepting new connections."
        };
      }
      if (inviteeSettings.whoCanAddYou === "connections") {
        // "People you've shared with" — allow only if the invitee has
        // already shared an item with the inviter (they're not strangers).
        const [sharedWithMe] = await db
          .select({ id: itemGrants.id })
          .from(itemGrants)
          .where(
            and(
              eq(itemGrants.ownerUserId, existingUser.id),
              eq(itemGrants.granteeUserId, userId),
              isNull(itemGrants.revokedAt)
            )
          )
          .limit(1);
        if (!sharedWithMe) {
          return {
            ok: false,
            code: "BLOCKED",
            message: "This person only accepts connections from people they've shared with."
          };
        }
      }
    }
  }

  // Dedupe an existing pending invite to the same email.
  const [dupe] = await db
    .select({ id: connectionInvitations.id })
    .from(connectionInvitations)
    .where(
      and(
        eq(connectionInvitations.inviterUserId, userId),
        eq(connectionInvitations.email, email),
        eq(connectionInvitations.status, "pending"),
        gte(connectionInvitations.expiresAt, new Date())
      )
    )
    .limit(1);
  if (dupe) {
    return { ok: false, code: "ALREADY_INVITED", message: "You've already invited them." };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  const [created] = await db
    .insert(connectionInvitations)
    .values({ inviterUserId: userId, email, token, expiresAt })
    .returning({ id: connectionInvitations.id });

  return {
    ok: true,
    invitationId: created!.id,
    url: inviteUrl(token),
    expiresAt: expiresAt.toISOString()
  };
}

export async function cancelInvitation(userId: string, invitationId: string): Promise<void> {
  await db
    .delete(connectionInvitations)
    .where(
      and(
        eq(connectionInvitations.id, invitationId),
        eq(connectionInvitations.inviterUserId, userId)
      )
    );
}

export type ConnectionInviteContext = {
  inviterName: string | null;
  inviterEmail: string;
  expiresAt: string;
  expired: boolean;
};

/** Public lookup for the accept page (pre/post sign-in). */
export async function findInvitationByToken(
  token: string
): Promise<ConnectionInviteContext | null> {
  const [row] = await db
    .select({
      status: connectionInvitations.status,
      expiresAt: connectionInvitations.expiresAt,
      inviterName: users.name,
      inviterEmail: users.email
    })
    .from(connectionInvitations)
    .innerJoin(users, eq(users.id, connectionInvitations.inviterUserId))
    .where(eq(connectionInvitations.token, token))
    .limit(1);
  if (!row || row.status !== "pending") return null;
  return {
    inviterName: row.inviterName,
    inviterEmail: row.inviterEmail,
    expiresAt: row.expiresAt.toISOString(),
    expired: row.expiresAt < new Date()
  };
}

export type AcceptResult =
  | { ok: true; inviterName: string | null }
  | { ok: false; code: "NOT_FOUND" | "EXPIRED" | "SELF"; message: string };

/** Accept a connection invitation — creates the connection, notifies inviter. */
export async function acceptInvitation(userId: string, token: string): Promise<AcceptResult> {
  const [row] = await db
    .select()
    .from(connectionInvitations)
    .where(eq(connectionInvitations.token, token))
    .limit(1);
  if (!row || row.status !== "pending") {
    return { ok: false, code: "NOT_FOUND", message: "This invitation is no longer valid." };
  }
  if (row.expiresAt < new Date()) {
    return { ok: false, code: "EXPIRED", message: "This invitation has expired." };
  }
  if (row.inviterUserId === userId) {
    return { ok: false, code: "SELF", message: "You can't accept your own invitation." };
  }

  await db
    .update(connectionInvitations)
    .set({ status: "accepted", acceptedAt: new Date() })
    .where(eq(connectionInvitations.id, row.id));

  await ensureConnection(row.inviterUserId, userId);

  const [accepter] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const accepterName = accepter?.name?.trim() || accepter?.email.split("@")[0] || "Someone";
  void createNotification({
    userId: row.inviterUserId,
    type: "system",
    title: `${accepterName} accepted your invitation. You can now share with them.`,
    href: "/people",
    payload: { kind: "connection_invite", actorUserId: userId }
  }).catch((error) => {
    logger.warn("connection_accept_notification_failed", {
      inviterUserId: row.inviterUserId,
      error: error instanceof Error ? error.message : String(error)
    });
  });

  const [inviter] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, row.inviterUserId))
    .limit(1);
  return { ok: true, inviterName: inviter?.name ?? null };
}
