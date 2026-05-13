import { describe, expect, it } from "vitest";
import {
  InvitationInvalidError,
  MealNameCollisionError,
  OwnerAccountDeletionBlockedError,
  OwnershipTransferRequiredError
} from "./households";

describe("household error classes", () => {
  it("OwnershipTransferRequiredError carries a stable code the UI branches on", () => {
    const err = new OwnershipTransferRequiredError();
    expect(err.code).toBe("OWNERSHIP_TRANSFER_REQUIRED");
    expect(err.name).toBe("OwnershipTransferRequiredError");
    expect(err).toBeInstanceOf(Error);
  });

  it("MealNameCollisionError exposes the colliding names array", () => {
    const err = new MealNameCollisionError(["Carbonara", "Soy Ginger Noodles"]);
    expect(err.code).toBe("MEAL_NAME_COLLISION");
    expect(err.collidingNames).toEqual(["Carbonara", "Soy Ginger Noodles"]);
    expect(err.message).toContain("Carbonara");
    expect(err.message).toContain("Soy Ginger Noodles");
  });

  it("InvitationInvalidError preserves the supplied code", () => {
    const err = new InvitationInvalidError("INVITATION_EXPIRED", "This invitation has expired.");
    expect(err.code).toBe("INVITATION_EXPIRED");
    expect(err.name).toBe("InvitationInvalidError");
    expect(err.message).toBe("This invitation has expired.");
  });

  it("OwnerAccountDeletionBlockedError carries the expected code", () => {
    const err = new OwnerAccountDeletionBlockedError();
    expect(err.code).toBe("OWNER_ACCOUNT_DELETION_BLOCKED");
    expect(err.name).toBe("OwnerAccountDeletionBlockedError");
  });
});
