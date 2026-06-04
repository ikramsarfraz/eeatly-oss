"use client";

import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

/**
 * Empty `baseURL` makes the client post to *same-origin* `/api/auth/...`. That
 * matters for the admin subdomain: signing in on `admin.<root>` must POST back
 * to `admin.<root>` (not the fixed root origin), otherwise it's a cross-origin
 * credentialed request the browser blocks. Better Auth still builds the
 * magic-link callback from the server-side `BETTER_AUTH_URL`, and the shared
 * cross-subdomain cookie carries the session across hosts.
 */
export const authClient = createAuthClient({
  baseURL: "",
  plugins: [magicLinkClient()]
});
