"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { logger } from "@/lib/observability/logger";
import { sanitizeCallbackURL } from "@/lib/auth/callback-url";

/**
 * Round 8 — sign out + redirect helper for the invite email-mismatch
 * flow. Wife is signed in on the shared phone; mom's invite arrives;
 * mom clicks. The invite page detects the email mismatch and renders
 * a "Sign out and accept as <invited_email>" button that calls this
 * action.
 *
 * The action signs out (clearing the Better Auth session cookie via
 * Set-Cookie in the response) and returns the URL the client should
 * navigate to. The UI does `window.location.assign(redirectTo)` so the
 * page reload picks up the cleared cookie state — `router.push` would
 * keep the in-memory session cache.
 *
 * `redirectTo` is sanitized via `sanitizeCallbackURL` to prevent
 * open-redirect: a malicious caller can't pass `//attacker.com/x` and
 * have us bounce there.
 */
export type SignOutAndRedirectResult =
  | { ok: true; redirectTo: string }
  | { ok: false; code: "OTHER"; message: string };

export async function signOutAndRedirectAction(input: {
  redirectTo: string;
}): Promise<SignOutAndRedirectResult> {
  const safeRedirect = sanitizeCallbackURL(input.redirectTo);
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    logger.warn("sign_out_and_redirect_failed", {
      error: error instanceof Error ? error.message : String(error)
    });
    return {
      ok: false,
      code: "OTHER",
      message: "Couldn't sign you out. Please try again."
    };
  }
  return { ok: true, redirectTo: safeRedirect };
}
