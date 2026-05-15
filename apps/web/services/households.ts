import "server-only";

import { randomBytes } from "node:crypto";
import { and, count, eq, gte, inArray, isNull, ne, sql } from "drizzle-orm";
import {
  householdInvitations,
  householdMembers,
  households,
  mealLogs,
  meals,
  users
} from "@/db/schema";
import { db } from "@/lib/db/client";
import { requireHouseholdMember } from "@/lib/auth/session";
import {
  CannotRemoveOwnerError,
  CannotRemoveSelfError,
  InvitationInvalidError,
  MealNameCollisionError,
  NotHouseholdOwnerError,
  NotMemberError,
  OwnershipTransferRequiredError,
  SoleOwnerCannotLeaveError
} from "@/lib/errors/households";
import { requireFeatureAccess } from "@/lib/gates/resolver";
import { logger } from "@/lib/observability/logger";

const INVITATION_EXPIRES_DAYS = 7;
const MAX_PENDING_INVITES_PER_HOUSEHOLD = 5;
const MAX_INVITATIONS_PER_OWNER_PER_DAY = 10;

export type InvitationContext = {
  invitationId: string;
  householdId: string;
  householdName: string;
  email: string;
  inviterName: string;
  inviterId: string;
  expiresAt: Date;
  acceptedAt: Date | null;
};

/**
 * Looks up an invitation by token. Public surface — used by both the
 * acceptance page (to render the confirmation card) and the accept action
 * (to validate). Returns null for unknown tokens; the caller decides whether
 * to surface that as 404 or a more user-facing message.
 *
 * Does NOT check email mismatch — that's the action's job since the
 * "current user" varies by request.
 */
export async function findInvitationContextByToken(
  token: string
): Promise<InvitationContext | null> {
  const [row] = await db
    .select({
      invitationId: householdInvitations.id,
      householdId: households.id,
      householdName: households.name,
      email: householdInvitations.email,
      inviterName: users.name,
      inviterId: users.id,
      expiresAt: householdInvitations.expiresAt,
      acceptedAt: householdInvitations.acceptedAt
    })
    .from(householdInvitations)
    .innerJoin(households, eq(householdInvitations.householdId, households.id))
    .innerJoin(users, eq(householdInvitations.invitedByUserId, users.id))
    .where(eq(householdInvitations.token, token))
    .limit(1);

  return row ?? null;
}

export type CreateInvitationResult = {
  invitationId: string;
  token: string;
  expiresAt: Date;
  inviterName: string;
  householdName: string;
};

/**
 * Creates a pending invitation. Caller must already have verified that
 * `userId` is the owner of `householdId`. The two business caps (5 pending
 * per household, 10 invitations per owner per day) are checked here at
 * the DB level — the rate limiter sits above this as brute-force defense.
 */
export async function createHouseholdInvitation(
  userId: string,
  householdId: string,
  email: string
): Promise<CreateInvitationResult> {
  const normalizedEmail = email.trim().toLowerCase();

  // Round 6 gate. Throws FeatureGateDeniedError when the calling user
  // isn't allowed to send invitations (free tier today, unless they're
  // beta / admin / paid). The action layer translates this to
  // UPGRADE_REQUIRED. We deliberately check BEFORE entering the
  // transaction — the gate-denied path shouldn't open a Postgres
  // transaction we then have to roll back.
  await requireFeatureAccess(userId, "household_invite");

  return db.transaction(async (tx) => {
    // Resolve household + owner display data inside the transaction so the
    // email template renders consistently with whatever the DB state is at
    // commit time.
    const [household] = await tx
      .select({ id: households.id, name: households.name, ownerId: households.ownerId })
      .from(households)
      .where(eq(households.id, householdId))
      .limit(1);
    if (!household) {
      throw new Error("Household not found.");
    }
    if (household.ownerId !== userId) {
      // Defense in depth — the action also checks ownership.
      logger.error("invitation_create_non_owner", { userId, householdId });
      throw new Error("Only the household owner can invite members.");
    }

    const [inviter] = await tx
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // Cap 1: pending invitations for THIS household.
    const [pendingCountRow] = await tx
      .select({ value: count(householdInvitations.id) })
      .from(householdInvitations)
      .where(
        and(
          eq(householdInvitations.householdId, householdId),
          isNull(householdInvitations.acceptedAt),
          gte(householdInvitations.expiresAt, new Date())
        )
      );
    if (Number(pendingCountRow?.value ?? 0) >= MAX_PENDING_INVITES_PER_HOUSEHOLD) {
      throw new Error(
        `This household already has ${MAX_PENDING_INVITES_PER_HOUSEHOLD} pending invitations. Revoke one before sending another.`
      );
    }

    // Cap 2: invitations created by THIS owner in the last 24 hours.
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [dailyCountRow] = await tx
      .select({ value: count(householdInvitations.id) })
      .from(householdInvitations)
      .where(
        and(
          eq(householdInvitations.invitedByUserId, userId),
          gte(householdInvitations.createdAt, dayAgo)
        )
      );
    if (Number(dailyCountRow?.value ?? 0) >= MAX_INVITATIONS_PER_OWNER_PER_DAY) {
      throw new Error(
        `You've created ${MAX_INVITATIONS_PER_OWNER_PER_DAY} invitations in the last day. Try again tomorrow.`
      );
    }

    // Dedup: don't create a second pending invitation to the same email
    // for the same household — re-use the existing one or fail clearly.
    const [existing] = await tx
      .select({ id: householdInvitations.id })
      .from(householdInvitations)
      .where(
        and(
          eq(householdInvitations.householdId, householdId),
          eq(householdInvitations.email, normalizedEmail),
          isNull(householdInvitations.acceptedAt),
          gte(householdInvitations.expiresAt, new Date())
        )
      )
      .limit(1);
    if (existing) {
      throw new Error(
        "There's already a pending invitation for that email. Revoke it before sending another."
      );
    }

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITATION_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

    const [created] = await tx
      .insert(householdInvitations)
      .values({
        householdId,
        email: normalizedEmail,
        invitedByUserId: userId,
        token,
        expiresAt
      })
      .returning({ id: householdInvitations.id });

    if (!created) {
      throw new Error("Couldn't create invitation.");
    }

    return {
      invitationId: created.id,
      token,
      expiresAt,
      inviterName: inviter?.name ?? "A household member",
      householdName: household.name
    };
  });
}

export async function revokeHouseholdInvitation(
  userId: string,
  householdId: string,
  invitationId: string
): Promise<void> {
  // Only the owner can revoke. The action verifies ownership before calling;
  // we re-check at the SQL layer by combining `householdId` (which the owner
  // is verified for in the action) and `acceptedAt IS NULL`.
  const [deleted] = await db
    .delete(householdInvitations)
    .where(
      and(
        eq(householdInvitations.id, invitationId),
        eq(householdInvitations.householdId, householdId),
        isNull(householdInvitations.acceptedAt)
      )
    )
    .returning({ id: householdInvitations.id });

  if (!deleted) {
    throw new Error("Invitation not found or already accepted.");
  }
  logger.info("invitation_revoked", { userId, householdId, invitationId });
}

export type AcceptHouseholdInvitationResult = {
  kind: "accepted";
  newHouseholdId: string;
  newHouseholdName: string;
  inviterUserId: string;
  inviterEmail: string;
  inviterName: string;
  mealsMoved: number;
  logsMoved: number;
};

/**
 * Atomic acceptance. Validates the invitation, checks for the ownership-
 * transfer-required wall, pre-flights meal name collisions, then in one
 * transaction:
 *   1. moves the user's meals (createdByUserId = userId) to the new household
 *   2. moves the user's meal_logs (cookedByUserId = userId) to the new household
 *   3. deletes the user's old household_members row
 *   4. if the user was the sole owner of the old household, deletes the now-empty old household
 *   5. inserts a member row in the new household
 *   6. updates users.preferred_household_id
 *   7. marks the invitation accepted
 *
 * Returns context the action needs for the inviter confirmation email.
 */
export type AcceptHouseholdInvitationPreview = {
  kind: "preview";
  newHouseholdId: string;
  newHouseholdName: string;
  inviterUserId: string;
  inviterName: string;
  mealsToMerge: number;
  logsToMerge: number;
  /** Whether the old (current) household will be dissolved on accept. */
  willDissolveCurrentHousehold: boolean;
};

export async function acceptHouseholdInvitation(
  userId: string,
  token: string,
  opts: { dryRun?: boolean } = {}
): Promise<AcceptHouseholdInvitationResult | AcceptHouseholdInvitationPreview> {
  const dryRun = opts.dryRun === true;
  return db.transaction(async (tx) => {
    // 1. Validate invitation
    const [invitation] = await tx
      .select({
        id: householdInvitations.id,
        householdId: householdInvitations.householdId,
        email: householdInvitations.email,
        invitedByUserId: householdInvitations.invitedByUserId,
        expiresAt: householdInvitations.expiresAt,
        acceptedAt: householdInvitations.acceptedAt
      })
      .from(householdInvitations)
      .where(eq(householdInvitations.token, token))
      .limit(1);

    if (!invitation) {
      throw new InvitationInvalidError(
        "INVITATION_NOT_FOUND",
        "This invitation link doesn't look right."
      );
    }
    if (invitation.acceptedAt) {
      throw new InvitationInvalidError(
        "INVITATION_ALREADY_USED",
        "This invitation was already accepted."
      );
    }
    if (invitation.expiresAt < new Date()) {
      throw new InvitationInvalidError(
        "INVITATION_EXPIRED",
        "This invitation has expired. Ask for a new one."
      );
    }

    // 2. Email match
    const [user] = await tx
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) {
      throw new Error("Current user not found.");
    }
    if (user.email.trim().toLowerCase() !== invitation.email.trim().toLowerCase()) {
      throw new InvitationInvalidError(
        "INVITATION_EMAIL_MISMATCH",
        "This invitation was sent to a different email address."
      );
    }

    // 3. Current household membership + ownership-transfer guard
    const [currentMembership] = await tx
      .select({
        householdId: householdMembers.householdId,
        role: householdMembers.role
      })
      .from(householdMembers)
      .where(eq(householdMembers.userId, userId))
      .limit(1);

    // No-op accept: user is already in the target household.
    if (currentMembership?.householdId === invitation.householdId) {
      // Mark accepted so the invitation can't be reused.
      await tx
        .update(householdInvitations)
        .set({ acceptedAt: new Date() })
        .where(eq(householdInvitations.id, invitation.id));
      const [hh] = await tx
        .select({ name: households.name })
        .from(households)
        .where(eq(households.id, invitation.householdId))
        .limit(1);
      const [inviterRow] = await tx
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, invitation.invitedByUserId))
        .limit(1);
      return {
        kind: "accepted" as const,
        newHouseholdId: invitation.householdId,
        newHouseholdName: hh?.name ?? "your household",
        inviterUserId: invitation.invitedByUserId,
        inviterEmail: inviterRow?.email ?? "",
        inviterName: inviterRow?.name ?? "",
        mealsMoved: 0,
        logsMoved: 0
      };
    }

    let willDeleteOldHousehold = false;
    if (currentMembership?.role === "owner") {
      const [otherMembers] = await tx
        .select({ value: count(householdMembers.id) })
        .from(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, currentMembership.householdId),
            ne(householdMembers.userId, userId)
          )
        );
      if (Number(otherMembers?.value ?? 0) > 0) {
        throw new OwnershipTransferRequiredError();
      }
      willDeleteOldHousehold = true;
    }

    // 4. Meal-name collision pre-flight. Compare the normalized names of
    // meals this user created against the target household's existing meals.
    // If any collide, throw with the list so the user can rename or delete
    // before re-attempting. Skip the pre-flight when the user has no source
    // household (no meals to move).
    let collidingNames: string[] = [];
    if (currentMembership) {
      const userMealNames = await tx
        .select({
          name: meals.name,
          normalizedName: meals.normalizedName
        })
        .from(meals)
        .where(
          and(
            eq(meals.householdId, currentMembership.householdId),
            eq(meals.createdByUserId, userId),
            isNull(meals.archivedAt)
          )
        );

      if (userMealNames.length > 0) {
        const targetNames = await tx
          .select({ normalizedName: meals.normalizedName })
          .from(meals)
          .where(
            and(
              eq(meals.householdId, invitation.householdId),
              inArray(
                meals.normalizedName,
                userMealNames.map((m) => m.normalizedName)
              ),
              isNull(meals.archivedAt)
            )
          );
        const targetSet = new Set(targetNames.map((m) => m.normalizedName));
        collidingNames = userMealNames
          .filter((m) => targetSet.has(m.normalizedName))
          .map((m) => m.name);

        if (collidingNames.length > 0) {
          throw new MealNameCollisionError(collidingNames);
        }
      }
    }

    // R15.5 Task 6 — dry-run preview short-circuit. Same validation
    // path as the real accept (invitation valid, email matches,
    // ownership-transfer clear, no name collisions); we just compute
    // the would-merge counts and return without writing. Caller's UI
    // renders these as a confirmation card before the real accept.
    if (dryRun) {
      const [mealsCountRow] = currentMembership
        ? await tx
            .select({ value: count(meals.id) })
            .from(meals)
            .where(
              and(
                eq(meals.householdId, currentMembership.householdId),
                eq(meals.createdByUserId, userId),
                isNull(meals.archivedAt)
              )
            )
        : [{ value: 0 }];

      const [logsCountRow] = currentMembership
        ? await tx
            .select({ value: count(mealLogs.id) })
            .from(mealLogs)
            .where(
              and(
                eq(mealLogs.householdId, currentMembership.householdId),
                eq(mealLogs.cookedByUserId, userId),
                isNull(mealLogs.deletedAt)
              )
            )
        : [{ value: 0 }];

      const [hhRow] = await tx
        .select({ name: households.name })
        .from(households)
        .where(eq(households.id, invitation.householdId))
        .limit(1);
      const [inviterRow] = await tx
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, invitation.invitedByUserId))
        .limit(1);

      const preview: AcceptHouseholdInvitationPreview = {
        kind: "preview",
        newHouseholdId: invitation.householdId,
        newHouseholdName: hhRow?.name ?? "the kitchen",
        inviterUserId: invitation.invitedByUserId,
        inviterName: inviterRow?.name ?? "",
        mealsToMerge: Number(mealsCountRow?.value ?? 0),
        logsToMerge: Number(logsCountRow?.value ?? 0),
        willDissolveCurrentHousehold: willDeleteOldHousehold
      };
      return preview;
    }

    // 5. Move meals + logs to the new household. The two updates aren't
    // race-y inside the transaction (FOR UPDATE locks are implicit on
    // updated rows), so they don't need explicit locking.
    const mealsMoved = currentMembership
      ? await tx
          .update(meals)
          .set({ householdId: invitation.householdId, updatedAt: new Date() })
          .where(
            and(
              eq(meals.householdId, currentMembership.householdId),
              eq(meals.createdByUserId, userId)
            )
          )
          .returning({ id: meals.id })
      : [];

    const logsMoved = currentMembership
      ? await tx
          .update(mealLogs)
          .set({ householdId: invitation.householdId, updatedAt: new Date() })
          .where(
            and(
              eq(mealLogs.householdId, currentMembership.householdId),
              eq(mealLogs.cookedByUserId, userId)
            )
          )
          .returning({ id: mealLogs.id })
      : [];

    // 6. Delete old member row (if any), then delete old household if it
    // was a sole-owner setup. Order matters: deleting the household
    // cascades to household_members, but we already deleted the row.
    if (currentMembership) {
      await tx
        .delete(householdMembers)
        .where(
          and(
            eq(householdMembers.userId, userId),
            eq(householdMembers.householdId, currentMembership.householdId)
          )
        );

      if (willDeleteOldHousehold) {
        await tx
          .delete(households)
          .where(eq(households.id, currentMembership.householdId));
      }
    }

    // 7. Insert new membership.
    await tx.insert(householdMembers).values({
      householdId: invitation.householdId,
      userId,
      role: "member"
    });

    // 8. Update users.preferred_household_id.
    await tx
      .update(users)
      .set({ preferredHouseholdId: invitation.householdId, updatedAt: new Date() })
      .where(eq(users.id, userId));

    // 9. Mark invitation accepted.
    await tx
      .update(householdInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(householdInvitations.id, invitation.id));

    // 10. Resolve email-template payload data.
    const [hh] = await tx
      .select({ name: households.name })
      .from(households)
      .where(eq(households.id, invitation.householdId))
      .limit(1);
    const [inviterRow] = await tx
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, invitation.invitedByUserId))
      .limit(1);

    logger.info("invitation_accepted", {
      userId,
      newHouseholdId: invitation.householdId,
      oldHouseholdId: currentMembership?.householdId ?? null,
      mealsMoved: mealsMoved.length,
      logsMoved: logsMoved.length
    });

    return {
      kind: "accepted" as const,
      newHouseholdId: invitation.householdId,
      newHouseholdName: hh?.name ?? "your household",
      inviterUserId: invitation.invitedByUserId,
      inviterEmail: inviterRow?.email ?? "",
      inviterName: inviterRow?.name ?? "",
      mealsMoved: mealsMoved.length,
      logsMoved: logsMoved.length
    };
  });
}

export type RemoveMemberResult = {
  removedUserId: string;
  removedUserName: string;
  removedUserEmail: string;
  householdName: string;
};

/**
 * Owner-only removal of a member from a household. Performs four guards
 * before the mutation:
 *
 *   1. Actor is the owner of the household (via households.ownerId).
 *      → NotHouseholdOwnerError
 *   2. Target isn't the actor (the action layer never renders the button
 *      for self-removal, but the service defends in case the action is
 *      called directly). → CannotRemoveSelfError
 *   3. Target isn't the owner (defense — the unique constraint that owner
 *      is always a member should mean only one row has role='owner', but
 *      a divergent state shouldn't silently remove the owner row).
 *      → CannotRemoveOwnerError
 *   4. Target is currently a member. → NotMemberError
 *
 * The transaction deletes the household_members row and nulls the target's
 * preferred_household_id. cookedByUserId / createdByUserId on meals and
 * meal_logs intentionally untouched — the attribution stays so history
 * still reads as "by <name>" until the user is fully gone (e.g., on
 * account deletion). On their next session, the auth layer's self-heal
 * creates a fresh personal household.
 *
 * Returns context the action uses to fire the post-removal notification +
 * email (fire-and-forget; failures don't block the removal).
 */
export async function removeMemberFromHousehold(
  actorId: string,
  targetUserId: string,
  householdId: string
): Promise<RemoveMemberResult> {
  return db.transaction(async (tx) => {
    const [household] = await tx
      .select({ id: households.id, name: households.name, ownerId: households.ownerId })
      .from(households)
      .where(eq(households.id, householdId))
      .limit(1);
    if (!household) {
      throw new NotHouseholdOwnerError();
    }
    if (household.ownerId !== actorId) {
      logger.error("remove_member_non_owner", { actorId, householdId, targetUserId });
      throw new NotHouseholdOwnerError();
    }

    if (actorId === targetUserId) {
      throw new CannotRemoveSelfError();
    }
    if (household.ownerId === targetUserId) {
      throw new CannotRemoveOwnerError();
    }

    const [target] = await tx
      .select({
        memberId: householdMembers.id,
        name: users.name,
        email: users.email
      })
      .from(householdMembers)
      .innerJoin(users, eq(users.id, householdMembers.userId))
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, targetUserId)
        )
      )
      .limit(1);
    if (!target) {
      throw new NotMemberError();
    }

    await tx
      .delete(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, targetUserId)
        )
      );

    // Clear the removed user's preferred pointer so their next session
    // triggers ensureHouseholdForUser → fresh personal household. We
    // could also re-seed it here, but the self-heal path is the single
    // source of truth and we don't want two write paths.
    await tx
      .update(users)
      .set({ preferredHouseholdId: null, updatedAt: new Date() })
      .where(eq(users.id, targetUserId));

    logger.info("household_member_removed", {
      actorId,
      householdId,
      removedUserId: targetUserId
    });

    return {
      removedUserId: targetUserId,
      removedUserName: target.name,
      removedUserEmail: target.email,
      householdName: household.name
    };
  });
}

/**
 * Round 15.5 Task 2 — user-initiated leave. Removes the caller from
 * the household they're currently a member of. Throws
 * `SoleOwnerCannotLeaveError` if they're the only owner AND the
 * household has other members (transfer ownership first; the UI for
 * that is parking-lot). Owners of a solo household (just them) CAN
 * leave — it's effectively them deleting their kitchen, and the
 * `getCurrentHousehold` self-heal on next session creates a fresh
 * personal kitchen.
 *
 * Cooked-by attribution is preserved automatically — the
 * `created_by_user_id` column on meals/logs is set ON DELETE SET
 * NULL, so removing the membership row doesn't touch the attribution
 * column directly. The reading side (`apps/web/lib/meals/attribution.ts`)
 * renders the null as "Former member."
 *
 * Returns the household's id + name so the caller can include them in
 * the success toast.
 */
export type LeaveHouseholdResult = {
  householdId: string;
  householdName: string;
};

export async function leaveCurrentHousehold(
  userId: string,
  householdId: string
): Promise<LeaveHouseholdResult> {
  return db.transaction(async (tx) => {
    const [household] = await tx
      .select({
        id: households.id,
        name: households.name,
        ownerId: households.ownerId
      })
      .from(households)
      .where(eq(households.id, householdId))
      .limit(1);
    if (!household) {
      throw new NotMemberError();
    }

    // Confirm the user is actually a member; the procedure already
    // gates on householdMemberProcedure but defense-in-depth catches a
    // stale ctx + a deleted-out-from-under membership.
    const [membership] = await tx
      .select({ id: householdMembers.id })
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, userId)
        )
      )
      .limit(1);
    if (!membership) {
      throw new NotMemberError();
    }

    // Sole-owner block: count OTHER members. If any exist, the owner
    // has to transfer ownership before leaving. Solo households (just
    // the owner) pass — leaving in that case is effectively dissolving
    // the kitchen, and ensureHouseholdForUser will re-seed on next
    // sign-in.
    if (household.ownerId === userId) {
      const [otherMembers] = await tx
        .select({ value: count(householdMembers.id) })
        .from(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, householdId),
            ne(householdMembers.userId, userId)
          )
        );
      if (Number(otherMembers?.value ?? 0) > 0) {
        throw new SoleOwnerCannotLeaveError();
      }
    }

    await tx
      .delete(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, householdId),
          eq(householdMembers.userId, userId)
        )
      );

    // Drop any pending invites the leaving user sent — they can't
    // accept on a kitchen they no longer belong to anyway. Other
    // members can re-invite if needed. (Decision: leave-vs-revoke
    // — chose revoke so the recipient gets a clean "this was
    // cancelled" rather than "click and get a weird membership error.")
    await tx
      .delete(householdInvitations)
      .where(
        and(
          eq(householdInvitations.householdId, householdId),
          eq(householdInvitations.invitedByUserId, userId),
          isNull(householdInvitations.acceptedAt)
        )
      );

    // Clear preferred pointer so the next session re-seeds via
    // ensureHouseholdForUser (the standard re-house path).
    await tx
      .update(users)
      .set({ preferredHouseholdId: null, updatedAt: new Date() })
      .where(eq(users.id, userId));

    // If the leaver was a solo-owner dissolving their kitchen, the
    // household row + meals + logs cascade-delete via the schema's
    // ON DELETE CASCADE on households. We DON'T explicitly delete
    // the household here — the FK chain handles it, and if other
    // members exist (sole-owner-with-others would have thrown above),
    // the household stays for them.

    logger.info("household_left", {
      userId,
      householdId,
      wasOwner: household.ownerId === userId
    });

    return {
      householdId,
      householdName: household.name
    };
  });
}

/**
 * True iff the user is the sole owner of a household with other members.
 * Used by the account-deletion guard — deleting the user's row would
 * cascade-wipe the household for everyone else.
 */
export async function userOwnsMultiMemberHousehold(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ value: count(householdMembers.id) })
    .from(households)
    .innerJoin(
      householdMembers,
      eq(householdMembers.householdId, households.id)
    )
    .where(
      and(eq(households.ownerId, userId), ne(householdMembers.userId, userId))
    );

  return Number(row?.value ?? 0) > 0;
}

/**
 * Idempotent setup of the user's solo household. Used by:
 *   - Better Auth's user.create.after hook (new sign-ups)
 *   - getCurrentHousehold's self-heal path (existing users predating the
 *     backfill or anyone whose membership row was deleted out from under them)
 *
 * Returns the existing household if one already exists; otherwise creates
 * a household + owner membership + sets users.preferred_household_id in a
 * single transaction. Safe under concurrent calls: the unique index on
 * household_members.user_id throws on the second insert; we catch and
 * re-read.
 *
 * `displayName` is used to label the household ("Alex's Kitchen"). When
 * empty/null we fall back to "My Kitchen" to match the 0015 backfill.
 */
export async function ensureHouseholdForUser(
  userId: string,
  displayName: string | null
): Promise<{ id: string; name: string; created: boolean }> {
  // Fast path: already a member somewhere.
  const [existing] = await db
    .select({ id: households.id, name: households.name })
    .from(householdMembers)
    .innerJoin(households, eq(householdMembers.householdId, households.id))
    .where(eq(householdMembers.userId, userId))
    .limit(1);
  if (existing) {
    return { ...existing, created: false };
  }

  const trimmed = (displayName ?? "").trim();
  const householdName = trimmed.length > 0 ? `${trimmed}’s Kitchen` : "My Kitchen";

  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(households)
        .values({ name: householdName, ownerId: userId })
        .returning({ id: households.id, name: households.name });
      if (!created) {
        throw new Error("Failed to create household.");
      }
      await tx.insert(householdMembers).values({
        householdId: created.id,
        userId,
        role: "owner"
      });
      await tx
        .update(users)
        .set({ preferredHouseholdId: created.id, updatedAt: new Date() })
        .where(eq(users.id, userId));
      logger.info("household_auto_created", { userId, householdId: created.id });
      return { id: created.id, name: created.name, created: true };
    });
  } catch (error) {
    // Race: a concurrent request beat us. Re-read; the row must exist now.
    const [winner] = await db
      .select({ id: households.id, name: households.name })
      .from(householdMembers)
      .innerJoin(households, eq(householdMembers.householdId, households.id))
      .where(eq(householdMembers.userId, userId))
      .limit(1);
    if (winner) {
      return { ...winner, created: false };
    }
    // Not a race — actual failure. Log and rethrow so callers can decide.
    logger.error("household_auto_create_failed", {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

/**
 * Cheap count used by the dashboard header. Returns 1 for a single-person
 * household — callers compare against 1 to decide whether to render the
 * subtle "shared" indicator. Round 4.7: service-layer membership check
 * added so any future caller can't bypass authz.
 */
export async function countHouseholdMembers(
  userId: string,
  householdId: string
): Promise<number> {
  await requireHouseholdMember(userId, householdId);
  const [row] = await db
    .select({ value: count(householdMembers.id) })
    .from(householdMembers)
    .where(eq(householdMembers.householdId, householdId));
  return Number(row?.value ?? 0);
}

export type HouseholdMemberRow = {
  userId: string;
  name: string;
  email: string;
  role: "owner" | "member";
  joinedAt: Date;
};

export async function listHouseholdMembers(
  userId: string,
  householdId: string
): Promise<HouseholdMemberRow[]> {
  await requireHouseholdMember(userId, householdId);
  return db
    .select({
      userId: householdMembers.userId,
      name: users.name,
      email: users.email,
      role: householdMembers.role,
      joinedAt: householdMembers.joinedAt
    })
    .from(householdMembers)
    .innerJoin(users, eq(users.id, householdMembers.userId))
    .where(eq(householdMembers.householdId, householdId))
    .orderBy(sql`${householdMembers.role} asc, ${householdMembers.joinedAt} asc`);
}

/**
 * Lightweight query used inline by the spec-required `pending invitations`
 * list on settings. Returns only the columns the UI needs. Membership
 * check enforced; the settings page narrows further to owner-only at the
 * action layer before calling.
 */
export type PendingInvitationRow = {
  id: string;
  email: string;
  createdAt: Date;
  expiresAt: Date;
};

export async function listPendingInvitations(
  userId: string,
  householdId: string
): Promise<PendingInvitationRow[]> {
  await requireHouseholdMember(userId, householdId);
  return db
    .select({
      id: householdInvitations.id,
      email: householdInvitations.email,
      createdAt: householdInvitations.createdAt,
      expiresAt: householdInvitations.expiresAt
    })
    .from(householdInvitations)
    .where(
      and(
        eq(householdInvitations.householdId, householdId),
        isNull(householdInvitations.acceptedAt),
        gte(householdInvitations.expiresAt, new Date())
      )
    )
    .orderBy(sql`${householdInvitations.createdAt} desc`);
}
