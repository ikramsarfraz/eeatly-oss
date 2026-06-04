/**
 * Round 8 — helpers for the invite → magic-link handoff.
 *
 * The invite page builds sign-in/sign-up links that carry a `callbackURL`
 * so Better Auth returns the user to `/invite/[token]` after magic-link
 * verification. We also prefill the email input via a `?email=` param so
 * a user opening the invite on a shared device doesn't have to type the
 * exact address.
 *
 * Both helpers are pure and unit-testable. The `sanitize` helper is the
 * defense against open-redirect: only same-origin paths beginning with a
 * single `/` are accepted; everything else falls back to `/home`.
 */

const DEFAULT_CALLBACK = "/home";

/**
 * Sanitize a callbackURL from an untrusted source (query param or
 * server action input). Accepts only same-origin paths. Rejects:
 *   - protocol-relative URLs (`//attacker.com/...`) — they parse as
 *     same-origin in `new URL(value, location)` on some browsers and
 *     hand off auth state to a third party.
 *   - absolute URLs (`https://...`) — no cross-origin redirects.
 *   - empty / non-string values.
 *
 * `/sign-in` and `/sign-up` are NOT rejected — the post-signout
 * email-mismatch flow legitimately needs to send the user there.
 */
export function sanitizeCallbackURL(raw: unknown): string {
  if (typeof raw !== "string") return DEFAULT_CALLBACK;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("/")) return DEFAULT_CALLBACK;
  if (trimmed.startsWith("//")) return DEFAULT_CALLBACK;
  return trimmed;
}

/**
 * Build the sign-in URL for a signed-out user opening an invite link.
 * Both `email` and `callbackURL` are appended; the sign-in form reads
 * them and routes the magic-link return trip back to the invite page.
 */
export function buildAuthCallbackHref(
  base: "/sign-in" | "/sign-up",
  opts: { email?: string; callbackURL: string }
): string {
  const params = new URLSearchParams();
  if (opts.email) params.set("email", opts.email);
  params.set("callbackURL", opts.callbackURL);
  return `${base}?${params.toString()}`;
}
