"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { households } from "@/db/schema";
import { requireCurrentUser, requireCurrentUserWithHousehold } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { dispatchTransactionalEmail } from "@/lib/email/transactional";
import { getServerEnv } from "@/lib/env/server";
import {
  CannotRemoveOwnerError,
  CannotRemoveSelfError,
  InvitationInvalidError,
  MealNameCollisionError,
  NotHouseholdOwnerError,
  NotMemberError,
  OwnershipTransferRequiredError
} from "@/lib/errors/households";
import { logger } from "@/lib/observability/logger";
import { checkInvitationLimit, checkMealMutationLimit } from "@/lib/security/rate-limit";
import {
  acceptInvitationSchema,
  createInvitationSchema,
  removeMemberSchema,
  revokeInvitationSchema,
  type AcceptInvitationInput,
  type CreateInvitationInput,
  type RemoveMemberInput,
  type RevokeInvitationInput
} from "@/lib/validators/households";
import { createNotification } from "@/services/notifications";
import {
  acceptHouseholdInvitation,
  createHouseholdInvitation,
  removeMemberFromHousehold,
  revokeHouseholdInvitation
} from "@/services/households";

export type CreateInvitationResult =
  | { ok: true; invitationId: string; expiresAt: string }
  | { ok: false; code: "VALIDATION" | "NOT_OWNER" | "RATE_LIMITED" | "ERROR"; message: string };

export type AcceptInvitationResult =
  | {
      ok: true;
      newHouseholdId: string;
      newHouseholdName: string;
      mealsMoved: number;
      logsMoved: number;
    }
  | {
      ok: false;
      code:
        | "VALIDATION"
        | "INVITATION_NOT_FOUND"
        | "INVITATION_EXPIRED"
        | "INVITATION_ALREADY_USED"
        | "INVITATION_EMAIL_MISMATCH"
        | "OWNERSHIP_TRANSFER_REQUIRED"
        | "MEAL_NAME_COLLISION"
        | "ERROR";
      message: string;
      collidingNames?: readonly string[];
    };

export type RevokeInvitationResult =
  | { ok: true }
  | { ok: false; code: "VALIDATION" | "NOT_OWNER" | "ERROR"; message: string };

export type RemoveMemberResult =
  | { ok: true; removedUserName: string }
  | {
      ok: false;
      code:
        | "VALIDATION"
        | "NOT_OWNER"
        | "CANNOT_REMOVE_SELF"
        | "CANNOT_REMOVE_OWNER"
        | "NOT_MEMBER"
        | "ERROR";
      message: string;
    };

function buildInviteUrl(token: string): string {
  const base = getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  return `${base}/invite/${encodeURIComponent(token)}`;
}

/**
 * Owner-only: creates a pending invitation for the current household.
 * Rate-limited at the API edge; hard daily cap enforced inside the service.
 */
export async function createInvitationAction(
  input: CreateInvitationInput
): Promise<CreateInvitationResult> {
  const parsed = createInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid input."
    };
  }

  const { user, household } = await requireCurrentUserWithHousehold();

  // Ownership check: only the household owner can invite. We could push this
  // into the service, but verifying here keeps the rate-limit check below
  // from running for non-owners (a small surface-reduction win).
  const [owner] = await db
    .select({ ownerId: households.ownerId })
    .from(households)
    .where(eq(households.id, household.id))
    .limit(1);

  if (owner?.ownerId !== user.id) {
    return {
      ok: false,
      code: "NOT_OWNER",
      message: "Only the household owner can invite members."
    };
  }

  try {
    await checkInvitationLimit(user.id);
  } catch {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "Too many invitations sent in a short time. Please try again later."
    };
  }

  try {
    const result = await createHouseholdInvitation(user.id, household.id, parsed.data.email);

    // Fire-and-forget email dispatch. If the send fails, the invitation row
    // still exists — the owner can copy the link from the settings list and
    // share manually. This mirrors how welcome-email failures don't block
    // sign-up.
    void dispatchTransactionalEmail({
      template: "household_invitation",
      toEmail: parsed.data.email,
      toName: parsed.data.email,
      userId: user.id,
      invitation: {
        inviterName: result.inviterName,
        householdName: result.householdName,
        inviteUrl: buildInviteUrl(result.token),
        expiresInDays: Math.max(
          1,
          Math.round((result.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        )
      }
    }).catch((error) => {
      logger.warn("invitation_email_dispatch_failed", {
        userId: user.id,
        invitationId: result.invitationId,
        error: error instanceof Error ? error.message : String(error)
      });
    });

    logger.info("invitation_created", {
      userId: user.id,
      householdId: household.id,
      invitationId: result.invitationId
    });

    revalidatePath("/settings");

    return {
      ok: true,
      invitationId: result.invitationId,
      expiresAt: result.expiresAt.toISOString()
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't send invitation.";
    logger.warn("invitation_create_failed", {
      userId: user.id,
      householdId: household.id,
      error: message
    });
    return { ok: false, code: "ERROR", message };
  }
}

/**
 * Authenticated invitee accepts a pending invitation. The service does the
 * heavy lifting (validation, collision pre-flight, atomic move). This action
 * shapes the error union for the UI, fires the inviter-notification, and
 * revalidates the dashboard.
 *
 * Uses the meal-mutation rate limiter — accepting moves rows around, and
 * we want a brute-force throttle without a dedicated bucket.
 */
export async function acceptInvitationAction(
  input: AcceptInvitationInput
): Promise<AcceptInvitationResult> {
  const parsed = acceptInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid invitation."
    };
  }

  const user = await requireCurrentUser();
  await checkMealMutationLimit(user.id);

  try {
    const result = await acceptHouseholdInvitation(user.id, parsed.data.token);

    // Notify the inviter that the invitee joined. Fire-and-forget — the
    // membership is committed regardless.
    void createNotification({
      userId: result.inviterUserId,
      type: "household_invitation",
      title: `${user.name} joined ${result.newHouseholdName}`,
      body: "Their meals and cook history have been merged into your kitchen.",
      href: "/settings"
    }).catch((error) => {
      logger.warn("invitation_accept_notify_failed", {
        userId: user.id,
        newHouseholdId: result.newHouseholdId,
        error: error instanceof Error ? error.message : String(error)
      });
    });

    logger.info("invitation_accepted", {
      userId: user.id,
      newHouseholdId: result.newHouseholdId,
      mealsMoved: result.mealsMoved,
      logsMoved: result.logsMoved
    });

    revalidatePath("/dashboard");
    revalidatePath("/history");
    revalidatePath("/ideas");
    revalidatePath("/settings");

    return {
      ok: true,
      newHouseholdId: result.newHouseholdId,
      newHouseholdName: result.newHouseholdName,
      mealsMoved: result.mealsMoved,
      logsMoved: result.logsMoved
    };
  } catch (error) {
    if (error instanceof InvitationInvalidError) {
      return { ok: false, code: error.code, message: error.message };
    }
    if (error instanceof OwnershipTransferRequiredError) {
      return { ok: false, code: error.code, message: error.message };
    }
    if (error instanceof MealNameCollisionError) {
      return {
        ok: false,
        code: error.code,
        message: error.message,
        collidingNames: error.collidingNames
      };
    }
    const message = error instanceof Error ? error.message : "Couldn't accept invitation.";
    logger.warn("invitation_accept_failed", { userId: user.id, error: message });
    return { ok: false, code: "ERROR", message };
  }
}

/**
 * Owner-only: hard-delete a pending invitation. Once accepted, an invitation
 * is immutable history — revoking a used invitation returns NOT_FOUND.
 */
export async function revokeInvitationAction(
  input: RevokeInvitationInput
): Promise<RevokeInvitationResult> {
  const parsed = revokeInvitationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid invitation id."
    };
  }

  const { user, household } = await requireCurrentUserWithHousehold();

  const [owner] = await db
    .select({ ownerId: households.ownerId })
    .from(households)
    .where(eq(households.id, household.id))
    .limit(1);

  if (owner?.ownerId !== user.id) {
    return {
      ok: false,
      code: "NOT_OWNER",
      message: "Only the household owner can revoke invitations."
    };
  }

  try {
    await revokeHouseholdInvitation(user.id, household.id, parsed.data.invitationId);
    revalidatePath("/settings");
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't revoke invitation.";
    return { ok: false, code: "ERROR", message };
  }
}

/**
 * Owner-only: remove a member from the current household. Defense-in-depth
 * — the service re-checks ownership and the four membership invariants
 * (self / owner / non-member). On success, fire-and-forget a notification +
 * email to the removed user; failures log but don't block the removal.
 *
 * The removed user lands in a fresh personal household on their next
 * session via the existing `ensureHouseholdForUser` self-heal path.
 */
export async function removeMemberAction(
  input: RemoveMemberInput
): Promise<RemoveMemberResult> {
  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION",
      message: parsed.error.issues[0]?.message ?? "Invalid request."
    };
  }

  const { user, household } = await requireCurrentUserWithHousehold();
  // Reuse the meal-mutation budget as the brute-force throttle. Member
  // removals are rare events; a dedicated limiter would be over-built.
  await checkMealMutationLimit(user.id);

  try {
    const result = await removeMemberFromHousehold(
      user.id,
      parsed.data.targetUserId,
      household.id
    );

    // Fire-and-forget post-mutation side effects. Same pattern as
    // milestone notifications: the removal is committed regardless.
    void createNotification({
      userId: result.removedUserId,
      type: "system",
      title: `You were removed from ${result.householdName}`,
      body: "You'll land in a fresh personal kitchen the next time you sign in.",
      href: "/dashboard"
    }).catch((error) => {
      logger.warn("removal_notification_failed", {
        actorId: user.id,
        removedUserId: result.removedUserId,
        error: error instanceof Error ? error.message : String(error)
      });
    });

    void dispatchTransactionalEmail({
      template: "household_member_removed",
      toEmail: result.removedUserEmail,
      toName: result.removedUserName,
      userId: result.removedUserId,
      removal: { householdName: result.householdName }
    }).catch((error) => {
      logger.warn("removal_email_dispatch_failed", {
        actorId: user.id,
        removedUserId: result.removedUserId,
        error: error instanceof Error ? error.message : String(error)
      });
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
    revalidatePath("/history");

    return { ok: true, removedUserName: result.removedUserName };
  } catch (error) {
    if (error instanceof NotHouseholdOwnerError) {
      return { ok: false, code: error.code, message: error.message };
    }
    if (error instanceof CannotRemoveSelfError) {
      return { ok: false, code: error.code, message: error.message };
    }
    if (error instanceof CannotRemoveOwnerError) {
      return { ok: false, code: error.code, message: error.message };
    }
    if (error instanceof NotMemberError) {
      return { ok: false, code: error.code, message: error.message };
    }
    const message = error instanceof Error ? error.message : "Couldn't remove member.";
    logger.warn("remove_member_failed", { actorId: user.id, error: message });
    return { ok: false, code: "ERROR", message };
  }
}
