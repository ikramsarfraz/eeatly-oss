import { describe, expect, it } from "vitest";
import { buildAuthCallbackHref, sanitizeCallbackURL } from "./callback-url";

describe("sanitizeCallbackURL", () => {
  it("accepts an internal path", () => {
    expect(sanitizeCallbackURL("/invite/abc123")).toBe("/invite/abc123");
    expect(sanitizeCallbackURL("/home")).toBe("/home");
  });

  it("rejects protocol-relative URLs (open-redirect guard)", () => {
    // `//attacker.com/path` is the classic open-redirect payload.
    expect(sanitizeCallbackURL("//attacker.com/path")).toBe("/home");
  });

  it("rejects absolute URLs", () => {
    expect(sanitizeCallbackURL("https://attacker.com/login")).toBe("/home");
    expect(sanitizeCallbackURL("http://example.com")).toBe("/home");
  });

  it("allows /sign-in and /sign-up — the email-mismatch flow targets them", () => {
    // /sign-in and /sign-up aren't rejected; the email-mismatch sign-out
    // path needs to redirect TO /sign-in after clearing the session.
    // Pre-existing sign-in page logic handles the "already signed in"
    // case if a real loop ever happens.
    expect(sanitizeCallbackURL("/sign-in?email=x")).toBe("/sign-in?email=x");
    expect(sanitizeCallbackURL("/sign-up?email=x")).toBe("/sign-up?email=x");
  });

  it("returns the default for non-string, missing, or non-rooted values", () => {
    expect(sanitizeCallbackURL(undefined)).toBe("/home");
    expect(sanitizeCallbackURL(null)).toBe("/home");
    expect(sanitizeCallbackURL(123)).toBe("/home");
    expect(sanitizeCallbackURL("dashboard")).toBe("/home");
  });

  it("preserves query strings on valid paths", () => {
    expect(sanitizeCallbackURL("/invite/abc?foo=bar")).toBe("/invite/abc?foo=bar");
  });
});

describe("buildAuthCallbackHref", () => {
  it("appends both email and callbackURL when both provided", () => {
    const href = buildAuthCallbackHref("/sign-in", {
      email: "mom@example.com",
      callbackURL: "/invite/abc123"
    });
    // URLSearchParams handles encoding — verify the email is encoded
    // (the `@` becomes `%40`) and the order is stable.
    expect(href).toBe(
      "/sign-in?email=mom%40example.com&callbackURL=%2Finvite%2Fabc123"
    );
  });

  it("omits email when not provided", () => {
    const href = buildAuthCallbackHref("/sign-in", {
      callbackURL: "/invite/abc"
    });
    expect(href).toBe("/sign-in?callbackURL=%2Finvite%2Fabc");
  });

  it("works for the sign-up base path too", () => {
    const href = buildAuthCallbackHref("/sign-up", {
      email: "mom@example.com",
      callbackURL: "/invite/abc"
    });
    expect(href.startsWith("/sign-up?")).toBe(true);
    expect(href).toContain("email=mom%40example.com");
    expect(href).toContain("callbackURL=%2Finvite%2Fabc");
  });
});
