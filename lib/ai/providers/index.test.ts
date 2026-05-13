import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OpenAI from "openai";

// Mock the logger up-front so we can assert log shape without it
// actually writing anywhere. Hoisted so the mocks are in place before
// `withFallback` is imported.
const loggerMock = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}));

vi.mock("@/lib/observability/logger", () => ({ logger: loggerMock }));

import { withFallback } from "./index";

beforeEach(() => {
  loggerMock.info.mockReset();
  loggerMock.warn.mockReset();
  loggerMock.error.mockReset();
});

afterEach(() => {
  // No queue to assert; vi.fn state is reset above.
});

function makeAuthError(status: 401 | 403) {
  return new OpenAI.APIError(
    status,
    { error: { message: "Unauthorized" } },
    "Unauthorized",
    new Headers()
  );
}

describe("withFallback", () => {
  it("returns the primary's result and does NOT call the fallback when primary succeeds", async () => {
    const primary = vi.fn(async () => "primary-ok");
    const fallback = vi.fn(async () => "fallback-ok");

    const result = await withFallback(primary, fallback, { operation: "test_op" });

    expect(result).toBe("primary-ok");
    expect(primary).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();

    // Single success log on the primary; no fallback noise.
    expect(loggerMock.info).toHaveBeenCalledTimes(1);
    const successCall = loggerMock.info.mock.calls[0];
    expect(successCall?.[0]).toBe("ai_provider_call");
    expect(successCall?.[1]).toMatchObject({
      provider: "openai",
      operation: "test_op",
      success: true
    });
    expect(loggerMock.warn).not.toHaveBeenCalled();
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  it("falls over to the fallback when the primary throws a non-auth error", async () => {
    const primary = vi.fn(async () => {
      throw new Error("primary degraded");
    });
    const fallback = vi.fn(async () => "fallback-ok");

    const result = await withFallback(primary, fallback, { operation: "test_op" });

    expect(result).toBe("fallback-ok");
    expect(primary).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledTimes(1);

    // Two warns (primary failure + fallback_triggered) and a single info on
    // the fallback's success.
    expect(loggerMock.warn).toHaveBeenCalledTimes(2);
    const triggerLog = loggerMock.warn.mock.calls.find(
      (c) => c[0] === "ai_fallback_triggered"
    );
    expect(triggerLog?.[1]).toMatchObject({
      operation: "test_op",
      primary_provider: "openai",
      fallback_provider: "anthropic",
      primary_error: "primary degraded"
    });

    const successLog = loggerMock.info.mock.calls.find(
      (c) =>
        c[0] === "ai_provider_call" &&
        (c[1] as Record<string, unknown>).fallback_triggered === true
    );
    expect(successLog?.[1]).toMatchObject({
      provider: "anthropic",
      operation: "test_op",
      success: true,
      fallback_triggered: true
    });
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  it("rethrows immediately and does NOT call fallback when primary throws an auth error", async () => {
    // Auth errors are config bugs (rotated key, revoked org, wrong project).
    // Falling over would silently mask the issue; users would see the
    // fallback provider's response and ops wouldn't know the primary was
    // misconfigured. The fast-fail is the contract that test covers.
    const authError = makeAuthError(401);
    const primary = vi.fn(async () => {
      throw authError;
    });
    const fallback = vi.fn(async () => "fallback-ok");

    await expect(
      withFallback(primary, fallback, { operation: "test_op" })
    ).rejects.toBe(authError);

    expect(primary).toHaveBeenCalledTimes(1);
    expect(fallback).not.toHaveBeenCalled();

    // Auth errors log via .error specifically, not the regular .warn path.
    expect(loggerMock.error).toHaveBeenCalledTimes(1);
    const errCall = loggerMock.error.mock.calls[0];
    expect(errCall?.[0]).toBe("ai_provider_auth_error");
    expect(errCall?.[1]).toMatchObject({
      provider: "openai",
      operation: "test_op"
    });
    // The "fallback triggered" line MUST NOT appear — it's the signal that
    // the contract held.
    expect(
      loggerMock.warn.mock.calls.find((c) => c[0] === "ai_fallback_triggered")
    ).toBeUndefined();
  });

  it("propagates the fallback's error (not the primary's) when both fail", async () => {
    const primaryErr = new Error("primary down");
    const fallbackErr = new Error("fallback also down");
    const primary = vi.fn(async () => {
      throw primaryErr;
    });
    const fallback = vi.fn(async () => {
      throw fallbackErr;
    });

    await expect(
      withFallback(primary, fallback, { operation: "test_op" })
    ).rejects.toBe(fallbackErr);

    expect(primary).toHaveBeenCalledTimes(1);
    expect(fallback).toHaveBeenCalledTimes(1);

    // Final logger.error carries the fallback's error context, so an alert
    // pointed at the "both providers down" line gets the right blame.
    const errCall = loggerMock.error.mock.calls.find(
      (c) =>
        c[0] === "ai_provider_call" &&
        (c[1] as Record<string, unknown>).provider === "anthropic"
    );
    expect(errCall?.[1]).toMatchObject({
      provider: "anthropic",
      operation: "test_op",
      success: false,
      fallback_triggered: true,
      error: "fallback also down"
    });
  });

  it("respects custom primary/fallback provider names in the context", async () => {
    const primary = vi.fn(async () => "ok");
    const fallback = vi.fn(async () => "unused");

    await withFallback(primary, fallback, {
      operation: "test_op",
      primaryProvider: "custom-primary",
      fallbackProvider: "custom-fallback"
    });

    expect(loggerMock.info.mock.calls[0]?.[1]).toMatchObject({
      provider: "custom-primary",
      operation: "test_op"
    });
  });
});
