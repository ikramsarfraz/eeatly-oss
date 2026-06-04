import "server-only";

/**
 * Round 15.5 Task 4 — deep-link URL substitution helpers.
 *
 * Two flavors of deep link end up in transactional emails:
 *   - Magic-link sign-in (R12): Better Auth invokes `pickMagicLinkUrl`
 *     and we inspect its embedded `callbackURL` for the `eeatly://`
 *     scheme. Mobile sign-in passes that callback so this works.
 *   - Household invite (R14 + R15.5): the invite URL is built by
 *     `buildInviteUrl(token)` in the households router. There is no
 *     embedded callbackURL — the recipient is whoever the inviter
 *     emailed, not the inviter themselves, so we determine "mobile
 *     context" from the INVITER's request origin instead.
 *
 * With Universal Links in place (R15.5 Task 3), the https web URL
 * already routes into the app when installed. The `eeatly://`
 * substitution remains useful as a fallback for users without the
 * apple-app-site-association cache populated yet, or for testing on
 * sims where Universal Links don't always work reliably.
 */

const MOBILE_ORIGIN_PATTERNS: ReadonlyArray<RegExp> = [
  /^eeatly:\/\//i,
  /^exp:\/\//i,
  /^http:\/\/localhost:8081/i,
  /^http:\/\/localhost:19006/i
];

/**
 * True if the request originated from the mobile app or Expo Go
 * dev runtime. Used to decide whether transactional URLs should use
 * the `eeatly://` scheme.
 */
export function isMobileOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return MOBILE_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

/**
 * Round 12 magic-link rewriter. Better Auth hands us a server URL of
 * the form `https://eeatly.app/api/auth/magic-link/verify?token=…&callbackURL=…`
 * and we decide whether to send that to the user's email or substitute
 * a mobile deep link. Mobile signal is the embedded callbackURL.
 *
 * Unchanged behavior from R12; lifted here from `lib/auth/index.ts`
 * so the invite-URL flow can share the helper module.
 */
export function pickMagicLinkUrl({
  url,
  token
}: {
  url: string;
  token: string;
}): string {
  try {
    const parsed = new URL(url);
    const callbackURL = parsed.searchParams.get("callbackURL") ?? "";
    if (isMobileOrigin(callbackURL)) {
      return `eeatly://verify?token=${encodeURIComponent(token)}`;
    }
  } catch {
    // Fall through to the default URL on any parse failure — web is
    // the safer default.
  }
  return url;
}

/**
 * Round 15.5 Task 4 — pick the invite URL for a transactional email.
 *
 * `webUrl` is the canonical https://eeatly.app/invite/<token> form.
 * When the inviter came from a mobile origin, substitute the
 * `eeatly://invite/<token>` scheme so the recipient's tap routes
 * directly into the app (assuming they have it installed).
 *
 *   - Mobile inviter: returns `eeatly://invite/<token>`. Mobile-app
 *     recipients deep-link straight in; web recipients see a
 *     "no app handles this" error (acceptable trade-off — invites
 *     between mobile-using households are family-level, so app
 *     install is overwhelmingly likely).
 *   - Web inviter: returns the original https URL. Works for both
 *     web recipients (browser) and mobile recipients (Universal
 *     Links handle the redirect when the app is installed).
 *
 * The `isMobile` flag is determined by the caller — typically by
 * inspecting `ctx.headers.get("origin")` via `isMobileOrigin`.
 */
export function pickInviteUrl({
  webUrl,
  token,
  isMobile
}: {
  webUrl: string;
  token: string;
  isMobile: boolean;
}): string {
  if (!isMobile) return webUrl;
  return `eeatly://invite/${encodeURIComponent(token)}`;
}
