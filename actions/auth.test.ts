import { beforeEach, describe, expect, it, vi } from "vitest";

// Short-circuit the env-validation chain. `lib/auth` reads env at module
// load; the action only needs `auth.api.signOut` to be callable.
const authMock = vi.hoisted(() => ({
  auth: { api: { signOut: vi.fn<(args: { headers: Headers }) => Promise<void>>() } }
}));
vi.mock("@/lib/auth", () => authMock);

// `headers()` from next/headers is read inside the action — return an
// empty Headers so the call passes through. `signOut` is what we assert
// on; the headers value doesn't matter for this test.
vi.mock("next/headers", () => ({
  headers: async () => new Headers()
}));

import { signOutAndRedirectAction } from "./auth";

beforeEach(() => {
  authMock.auth.api.signOut.mockReset();
  authMock.auth.api.signOut.mockResolvedValue();
});

describe("signOutAndRedirectAction", () => {
  it("returns ok with the sanitized redirect on success", async () => {
    const result = await signOutAndRedirectAction({
      redirectTo: "/sign-in?email=mom%40example.com&callbackURL=%2Finvite%2Fabc"
    });
    expect(result).toEqual({
      ok: true,
      redirectTo: "/sign-in?email=mom%40example.com&callbackURL=%2Finvite%2Fabc"
    });
    expect(authMock.auth.api.signOut).toHaveBeenCalledOnce();
  });

  it("falls back to /dashboard when redirectTo is an open-redirect attempt", async () => {
    // `//attacker.com/x` is the classic open-redirect payload — sanitize
    // strips it to the default. This is the security-critical assertion.
    const result = await signOutAndRedirectAction({
      redirectTo: "//attacker.com/login"
    });
    expect(result).toEqual({ ok: true, redirectTo: "/dashboard" });
  });

  it("falls back to /dashboard when redirectTo is an absolute URL", async () => {
    const result = await signOutAndRedirectAction({
      redirectTo: "https://attacker.com/login"
    });
    expect(result).toEqual({ ok: true, redirectTo: "/dashboard" });
  });

  it("returns OTHER when Better Auth's signOut throws", async () => {
    authMock.auth.api.signOut.mockRejectedValueOnce(new Error("auth down"));
    const result = await signOutAndRedirectAction({
      redirectTo: "/invite/abc"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("OTHER");
      expect(result.message).toMatch(/Couldn't sign you out/);
    }
  });

  it("invokes signOut with the request headers", async () => {
    await signOutAndRedirectAction({ redirectTo: "/dashboard" });
    expect(authMock.auth.api.signOut).toHaveBeenCalledWith(
      expect.objectContaining({ headers: expect.any(Headers) })
    );
  });
});
