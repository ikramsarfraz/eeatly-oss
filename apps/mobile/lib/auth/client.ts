import { createAuthClient } from "better-auth/client";
import { magicLinkClient } from "better-auth/client/plugins";
import { AUTH_URL } from "../api-base";
import { getSessionToken, setSessionToken } from "./session";

/**
 * Round 12 — Better Auth client configured for mobile.
 *
 * Three things the web client doesn't need:
 *   1. The `fetchOptions.auth.type === "Bearer"` config tells the
 *      better-auth client to use Authorization headers instead of
 *      cookies (cookies don't survive cross-origin app↔server).
 *   2. A custom `fetchOptions.onResponse` hook captures the
 *      `set-auth-token` header on responses and persists it. Better
 *      Auth emits this header on every authenticated response when
 *      the `bearer` plugin is enabled server-side.
 *   3. A custom `customFetchImpl` reads the persisted bearer token
 *      from SecureStore before every request.
 *
 * The `magicLinkClient` plugin gives us `authClient.signIn.magicLink(
 * { email, callbackURL })` with the right shape; we pass
 * `callbackURL: "eeatly://verify"` to trigger the mobile deep-link
 * path on the server (see `apps/web/lib/auth/index.ts:pickMagicLinkUrl`).
 */
export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  fetchOptions: {
    auth: {
      type: "Bearer",
      token: async () => (await getSessionToken()) ?? undefined
    },
    // iOS' shared NSURLSession cookie jar replays cookies set by an
    // earlier `getSession()` GET on every subsequent request to the
    // same host. Better Auth's CSRF guard treats a cookie-bearing
    // request without an `Origin` header as suspicious and rejects it
    // with MISSING_OR_NULL_ORIGIN. Send our scheme as the origin so
    // the guard passes (trustedOrigins already includes `eeatly://`).
    headers: { Origin: "eeatly://" },
    onResponse: async (ctx) => {
      const token = ctx.response.headers.get("set-auth-token");
      if (token) {
        // Better Auth emits `set-auth-token` whenever a new session is
        // minted (sign-in, refresh, magic-link verify). Persist it
        // immediately so every subsequent request rides the new value.
        await setSessionToken(token);
      }
    }
  },
  plugins: [magicLinkClient()]
});
