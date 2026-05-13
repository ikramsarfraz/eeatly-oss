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
