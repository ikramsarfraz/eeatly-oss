import { beforeEach, describe, expect, it, vi } from "vitest";

// All three mocks are hoisted via vi.mock and resolve before the action's
// module-load imports. The action's body short-circuits to OWNER_BLOCK
// before touching `headers()`, `auth.api.signOut`, or `redirect()` — so
// those Next.js / Better Auth surfaces don't need to be mocked.

// Several `services/*` and `lib/*` modules eagerly read env at module-load
// via getServerEnv(). Stub the heavy dependencies that the import chain
// (account.ts → lib/auth + services/account) walks through, so the unit
// test doesn't need the full server env. The OWNER_BLOCK branch returns
// before any of these are actually called.
vi.mock("@/lib/auth", () => ({
  auth: { api: { signOut: async () => undefined } }
}));

vi.mock("@/services/account", () => ({
  deleteUserAccount: async () => undefined
}));

vi.mock("@/lib/auth/session", () => ({
  requireCurrentUser: async () => ({
    id: "u-1",
    name: "Alex",
    email: "alex@example.com",
    image: null,
    role: "root_app_user" as const
  })
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkMealMutationLimit: async () => undefined
}));

// Round 9: deleteAccountAction now sends a confirmation email pre-delete.
// Mock at the boundary so the test doesn't drag the Resend/transactional
// chain (which validates env at module load).
const emailMock = vi.hoisted(() => ({
  sendAccountDeletedEmail: vi.fn<(email: string, name: string, userId?: string) => Promise<unknown>>()
}));
vi.mock("@/lib/email/transactional", () => emailMock);

const householdMock = vi.hoisted(() => ({
  userOwnsMultiMemberHousehold: vi.fn<(userId: string) => Promise<boolean>>()
}));

vi.mock("@/services/households", () => householdMock);

import { deleteAccountAction } from "./account";

beforeEach(() => {
  householdMock.userOwnsMultiMemberHousehold.mockReset();
  emailMock.sendAccountDeletedEmail.mockReset();
  emailMock.sendAccountDeletedEmail.mockResolvedValue({ skipped: false });
});

describe("deleteAccountAction discriminated-union surface", () => {
  it("returns OWNER_BLOCK without calling signout/redirect when the user owns a multi-member household", async () => {
    householdMock.userOwnsMultiMemberHousehold.mockResolvedValueOnce(true);

    const result = await deleteAccountAction("delete my account");

    expect(result).toEqual({ ok: false, code: "OWNER_BLOCK" });
    expect(householdMock.userOwnsMultiMemberHousehold).toHaveBeenCalledWith("u-1");
  });

  it("returns OTHER with a typed message when the confirmation phrase doesn't match", async () => {
    // Mismatch fires before the household guard, so userOwnsMultiMemberHousehold
    // should NOT have been called.
    householdMock.userOwnsMultiMemberHousehold.mockResolvedValueOnce(false);

    const result = await deleteAccountAction("nope");

    expect(result.ok).toBe(false);
    if (!result.ok && result.code === "OTHER") {
      expect(result.message).toContain("delete my account");
    } else {
      throw new Error(`Expected OTHER result, got: ${JSON.stringify(result)}`);
    }
    expect(householdMock.userOwnsMultiMemberHousehold).not.toHaveBeenCalled();
  });
});
