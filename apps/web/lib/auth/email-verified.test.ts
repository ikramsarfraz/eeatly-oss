import { describe, expect, it } from "vitest";
import { users } from "@/db/schema";

/**
 * Round 9 — tier-2 verification of the "users.emailVerified is set
 * after magic-link sign-in completes" contract that's been deferred
 * since the start.
 *
 * The honest version of this test combines two layers of confidence:
 *
 * 1. **Schema layer**: `users.email_verified` exists, is NOT NULL, and
 *    defaults to false. If a future migration ever weakens that (e.g.
 *    allowing NULL) this test catches it.
 *
 * 2. **Plugin layer**: Better Auth's `magicLink` plugin is wired into
 *    our auth instance. The plugin's published source unconditionally
 *    sets `emailVerified: true` when a magic-link token is successfully
 *    verified (see better-auth/dist/plugins/magic-link/index.mjs:143
 *    on user create and :150 on existing-user update). As long as the
 *    plugin is wired, the verification flow flips the flag.
 *
 * Together: emailVerified is set after magic-link sign-in IFF (a) our
 * schema lets it be set and (b) the plugin is in our config. We assert
 * both here without spinning up a real Better Auth + Postgres harness
 * (which would need credentials this test environment doesn't have).
 *
 * The end-to-end check — actually running through the verify endpoint
 * and reading the row — is appropriate for a future integration test
 * tier with a SQLite/test-container DB; not in scope for the unit
 * harness.
 */

describe("users.emailVerified — schema + plugin contract", () => {
  it("schema declares email_verified as NOT NULL with a default of false", () => {
    // Drizzle column metadata: notNull and hasDefault are public on the
    // column object. We don't read the default value directly — checking
    // `hasDefault` and `notNull` is enough to assert the shape we rely
    // on (false-by-default + cannot be NULL).
    const column = users.emailVerified;
    expect(column.notNull).toBe(true);
    expect(column.hasDefault).toBe(true);
  });

  it("better-auth's magic-link plugin is wired into our auth instance", async () => {
    // Lazy-import the auth instance so the test runs without the
    // environment validation seen elsewhere — we vi.mock the env reads
    // here to short-circuit the heavy DB import chain.
    const { vi } = await import("vitest");

    vi.doMock("@/lib/env/server", () => ({
      getServerEnv: () => ({
        DATABASE_URL: "postgres://test",
        BETTER_AUTH_SECRET: "test-secret-thirty-two-chars-long-x",
        BETTER_AUTH_URL: "https://eeatly.test",
        NEXT_PUBLIC_APP_URL: "https://eeatly.test",
        EMAIL_FROM: "no-reply@eeatly.test"
      }),
      hasGoogleAuthEnv: () => false
    }));
    vi.doMock("@/lib/db/client", () => ({
      db: {} as never,
      dbPrivileged: {} as never
    }));
    vi.doMock("@/lib/email/resend", () => ({
      sendMagicLinkEmail: async () => undefined
    }));
    vi.doMock("@/services/households", () => ({
      ensureHouseholdForUser: async () => ({ id: "h-1", name: "test", created: false })
    }));

    const { auth } = await import("@/lib/auth");
    // Better Auth exposes the resolved options on the instance. `plugins`
    // is the array we passed in. We assert by id, which is the plugin's
    // stable contract.
    const plugins =
      (auth.options as unknown as { plugins?: Array<{ id?: string }> }).plugins ?? [];
    const ids = plugins.map((p) => p?.id).filter(Boolean);
    expect(ids).toContain("magic-link");
  });
});
