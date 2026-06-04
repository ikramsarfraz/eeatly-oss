/**
 * Typed error classes for the household invitation flow. The UI branches on
 * `.code` to surface the right message; the server logs by name. Don't catch
 * by `instanceof Error` and stringify — the UI loses the discriminator.
 */

export class OwnershipTransferRequiredError extends Error {
  readonly code = "OWNERSHIP_TRANSFER_REQUIRED" as const;
  constructor() {
    super(
      "Transfer ownership of your current household before joining another. Contact support."
    );
    this.name = "OwnershipTransferRequiredError";
  }
}

export class MealNameCollisionError extends Error {
  readonly code = "MEAL_NAME_COLLISION" as const;
  readonly collidingNames: readonly string[];
  constructor(collidingNames: readonly string[]) {
    super(
      `Some of your meals match names already in the new household: ${collidingNames.join(", ")}. Rename or delete the duplicates before joining.`
    );
    this.name = "MealNameCollisionError";
    this.collidingNames = collidingNames;
  }
}

export class InvitationInvalidError extends Error {
  readonly code:
    | "INVITATION_NOT_FOUND"
    | "INVITATION_EXPIRED"
    | "INVITATION_ALREADY_USED"
    | "INVITATION_EMAIL_MISMATCH";
  constructor(code: InvitationInvalidError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "InvitationInvalidError";
  }
}

export class OwnerAccountDeletionBlockedError extends Error {
  readonly code = "OWNER_ACCOUNT_DELETION_BLOCKED" as const;
  constructor() {
    super(
      "You own a household with other members. Transfer ownership or remove members before deleting your account."
    );
    this.name = "OwnerAccountDeletionBlockedError";
  }
}

/**
 * Round 4.5 member-removal errors. The action layer translates each `.code`
 * into a discriminated-union result so the UI can branch without
 * stringifying.
 */
export class NotHouseholdOwnerError extends Error {
  readonly code = "NOT_OWNER" as const;
  constructor() {
    super("Only the household owner can remove members.");
    this.name = "NotHouseholdOwnerError";
  }
}

export class CannotRemoveSelfError extends Error {
  readonly code = "CANNOT_REMOVE_SELF" as const;
  constructor() {
    super(
      "Owners can't remove themselves — transfer ownership first, then ask the new owner to remove you."
    );
    this.name = "CannotRemoveSelfError";
  }
}

export class CannotRemoveOwnerError extends Error {
  readonly code = "CANNOT_REMOVE_OWNER" as const;
  constructor() {
    super("Cannot remove the household owner.");
    this.name = "CannotRemoveOwnerError";
  }
}

export class NotMemberError extends Error {
  readonly code = "NOT_MEMBER" as const;
  constructor() {
    super("That person isn't a member of this household.");
    this.name = "NotMemberError";
  }
}

/**
 * Round 15.5 Task 2 — raised when the sole owner of a household tries
 * to leave. They have to transfer ownership first (UI for that is
 * still a parking-lot item; this error is the user's signal to
 * contact support). Different from `OwnerAccountDeletionBlockedError`
 * which is raised only on account-delete; `SoleOwnerCannotLeaveError`
 * fires from the "Leave kitchen" flow.
 */
export class SoleOwnerCannotLeaveError extends Error {
  readonly code = "SOLE_OWNER" as const;
  constructor() {
    super(
      "You're the only owner of this kitchen. Transfer ownership before leaving, or delete the kitchen."
    );
    this.name = "SoleOwnerCannotLeaveError";
  }
}
