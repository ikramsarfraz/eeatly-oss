import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { bearer, magicLink } from "better-auth/plugins";
import { db } from "@/lib/db/client";
import * as schema from "@/db/schema";
import { isMobileOrigin, pickMagicLinkUrl } from "@/lib/auth/deep-links";
import {
  crossSubdomainCookiesEnabled,
  getRootDomain
} from "@/lib/auth/admin-host";
import { getServerEnv, hasGoogleAuthEnv } from "@/lib/env/server";
import { sendMagicLinkEmail } from "@/lib/email/resend";
import { logger } from "@/lib/observability/logger";
import { trackEvent } from "@/lib/observability/analytics";
import { capturePostHogServerEvent } from "@/lib/observability/posthog-server";
import { ensureHouseholdForUser } from "@/services/households";
import { seedMeasurementSystem } from "@/services/user-settings";
import { inferMeasurementSystem } from "@/lib/units/detect";

/**
 * Round 15.5 Task 1 — env access deferred. Previously this module
 * ran `getServerEnv()` at import, which broke `next build` when
 * routes that transitively imported `auth` triggered env validation
 * during page-data collection. The `auth` instance is now built
 * lazily on first access via a Proxy (see bottom of file).
 *
 * The fail-fast contract still holds: as soon as anything actually
 * touches `auth.api.*` or `auth.handler`, env validation runs and
 * throws if a required var is missing.
 */

/**
 * Better Auth rejects server actions from origins not listed here.
 * Dev often runs on alternate ports (:3001, …) while .env stays on :3000 — widen in development only.
 */
function developmentLocalhostOrigins(): string[] {
  if (process.env.NODE_ENV === "production") {
    return [];
  }

  const ports = ["3000", "3001", "3002", "3003", "5173"];
  const hosts = ["localhost", "127.0.0.1"];
  const out: string[] = [];

  for (const hostname of hosts) {
    for (const port of ports) {
      out.push(`http://${hostname}:${port}`);
    }
  }

  return out;
}

/**
 * Round 12 — mobile clients sign in from custom URL schemes (eeatly://)
 * and Expo dev URLs (exp://...). Better Auth checks the request Origin
 * against this list before honouring credentialed requests, so we have
 * to enumerate every variant we expect.
 *
 *   - `eeatly://` — production app scheme (configured in apps/mobile's
 *     app.json). Magic-link callbacks land on `eeatly://verify`.
 *   - `exp://*` — Expo Go runtime origins; the wildcard form is what
 *     Better Auth recognizes for a scheme without a stable host.
 *   - `http://localhost:8081` — Expo Metro bundler dev server.
 *   - `http://localhost:19006` — Expo Web's dev port.
 */
function mobileTrustedOrigins(): string[] {
  return [
    "eeatly://",
    "exp://",
    "http://localhost:8081",
    "http://localhost:19006"
  ];
}

/**
 * When ROOT_DOMAIN is configured, trust every subdomain of it so the
 * `admin.<root>` surface can make credentialed auth requests (sign-in). Better
 * Auth's `matchesOriginPattern` supports glob wildcards, so one `*.<root>`
 * entry covers all subdomains without enumeration. Dev ports are added because
 * the local Host carries `:3003` (e.g. `http://admin.localtest.me:3003`).
 */
function subdomainWildcardOrigins(): string[] {
  const root = getRootDomain();
  if (!root) return [];
  const out = [`https://*.${root}`, `http://*.${root}`];
  if (process.env.NODE_ENV !== "production") {
    for (const port of ["3000", "3001", "3002", "3003", "5173"]) {
      out.push(`http://*.${root}:${port}`, `https://*.${root}:${port}`);
    }
  }
  return out;
}

function trustedOriginsList(env: ReturnType<typeof getServerEnv>): string[] {
  const fromEnv = [env.NEXT_PUBLIC_APP_URL, env.BETTER_AUTH_URL].filter(Boolean);
  return [
    ...new Set([
      ...fromEnv,
      ...developmentLocalhostOrigins(),
      ...subdomainWildcardOrigins(),
      ...mobileTrustedOrigins()
    ])
  ];
}

function buildAuth() {
  const env = getServerEnv();
  const appUrl = env.BETTER_AUTH_URL;
  const socialProviders =
    hasGoogleAuthEnv(env) && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET
          }
        }
      : undefined;
  return betterAuth({
    appName: "eeatly",
    baseURL: appUrl,
    secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
      user: schema.users,
      session: schema.sessions,
      account: schema.accounts,
      verification: schema.verifications
    }
  }),
  plugins: [
    magicLink({
      storeToken: "hashed",
      sendMagicLink: async ({ email, url, token }) => {
        // Round 12 — when the caller's `callbackURL` is a mobile deep
        // link (`eeatly://...`), Better Auth's default `url` is a server
        // URL that would open the user's browser. The browser-issued
        // session cookie wouldn't transfer to the native app on the
        // post-verify redirect, so mobile would never get a session.
        //
        // We detect the mobile case by inspecting `callbackURL` inside
        // the `url`'s query string. For mobile we send the email link
        // pointing at our own deep-link route — the app catches it,
        // calls Better Auth's verify endpoint via fetch, and reads the
        // session token from the `set-auth-token` response header
        // (added by the `bearer` plugin). Web flows are untouched and
        // continue using the default server URL.
        const link = pickMagicLinkUrl({ url, token });
        await sendMagicLinkEmail(email, link);
      }
    }),
    // Round 12 — bearer-token support for the mobile app. The plugin
    // converts incoming `Authorization: Bearer <token>` headers into the
    // equivalent session-cookie lookup, so every existing
    // `auth.api.getSession({ headers })` call site (server components,
    // tRPC context) keeps working without changes. Mobile gets the token
    // back from sign-in via the `set-auth-token` response header (Better
    // Auth's documented mobile flow); it stores the token in expo-
    // secure-store and includes it on every subsequent request.
    bearer()
  ],
  ...(socialProviders ? { socialProviders } : {}),
  user: {
    additionalFields: {
      role: {
        type: ["root_app_user", "tenant_user", "platform_admin"],
        required: false,
        defaultValue: "root_app_user",
        input: false
      }
    }
  },
  databaseHooks: {
    user: {
      create: {
        // Round-4 invariant: every user must be a member of exactly one
        // household. Run this *after* the user row commits so the FK in
        // household_members can resolve. Failure here would leave the user
        // without a household — getCurrentHousehold also self-heals as a
        // backstop, but logging here makes the gap visible in metrics.
        after: async (user, ctx) => {
          try {
            await ensureHouseholdForUser(user.id, user.name ?? null);
          } catch (error) {
            logger.error("user_create_household_setup_failed", {
              userId: user.id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          // The signup (magic-link verify / OAuth callback) request is the
          // only point we have request headers tied to the new user. We read
          // them once here and reuse for two signals: measurement-system
          // inference and signup-platform attribution.
          const headers = (
            ctx as { request?: Request; headers?: Headers } | undefined
          )?.request?.headers ??
            (ctx as { headers?: Headers } | undefined)?.headers ??
            null;
          // Web vs mobile signup. The mobile app sets `Origin: eeatly://` on
          // every auth request (apps/mobile/lib/auth/client.ts), so the verify
          // call that creates the row carries it; web callbacks don't. Defaults
          // to "web" when the header is absent.
          const signupPlatform = isMobileOrigin(headers?.get("origin"))
            ? "mobile"
            : "web";

          // Infer the cook's measurement system ONCE, from the signup
          // request's geo (Vercel `x-vercel-ip-country`) + Accept-Language.
          // Flippable later in Settings → Kitchen. Failure-isolated:
          // a missing header or a write hiccup falls back to the column
          // default ('metric') and never blocks account creation.
          try {
            const system = inferMeasurementSystem({
              country:
                headers?.get("x-vercel-ip-country") ??
                headers?.get("cf-ipcountry") ??
                null,
              acceptLanguage: headers?.get("accept-language") ?? null
            });
            await seedMeasurementSystem(user.id, system);
          } catch (error) {
            logger.warn("user_create_units_seed_failed", {
              userId: user.id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
          // True signup signal — fires once, when the account row is
          // actually created (magic-link verified), not when the link is
          // requested. Both the in-house event log and PostHog get it
          // here so the two stay consistent. Each is failure-isolated so
          // analytics can never block account creation.
          trackEvent({
            name: "signed_up",
            userId: user.id,
            metadata: { platform: signupPlatform }
          });
          await capturePostHogServerEvent({
            distinctId: user.id,
            event: "signed_up",
            properties: { email: user.email, platform: signupPlatform }
          });
        }
      }
    }
  },
  session: {
    // A recipe library is used occasionally, not daily, so sign-in
    // friction is amplified by being rare and forgotten between visits.
    // Long ROLLING sessions make re-auth a ~twice-a-year non-event. This
    // governs BOTH the web cookie and the mobile bearer token (same server
    // session) — no per-platform change needed.
    //
    // `expiresIn` is the inactive window: how long you can stay away
    // before re-auth. `updateAge` refreshes an active session's expiry on
    // use (at most once a day), so an active user effectively never gets
    // logged out. Default was 7d/1d; we lean long (low-sensitivity data).
    expiresIn: 60 * 60 * 24 * 90, // 90 days
    updateAge: 60 * 60 * 24, // 1 day (rolling refresh)
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60
    }
  },
    trustedOrigins: trustedOriginsList(env),
    // Share the session cookie across `eeatly.com` and its `admin.` subdomain
    // (and `localtest.me` locally) so signing in on any host carries to the
    // admin surface. Off for localhost/unset ROOT_DOMAIN — browsers reject a
    // shared cookie Domain there, and single-origin needs no sharing.
    ...(crossSubdomainCookiesEnabled()
      ? {
          advanced: {
            crossSubDomainCookies: {
              enabled: true,
              domain: getRootDomain() as string
            }
          }
        }
      : {})
  });
}

type RealAuth = ReturnType<typeof buildAuth>;
let _auth: RealAuth | null = null;

function getAuth(): RealAuth {
  if (_auth) return _auth;
  _auth = buildAuth();
  return _auth;
}

// Lazy `auth` proxy — same call-site shape (`auth.api.getSession`,
// `auth.handler`) as before, but the underlying betterAuth instance
// isn't built until first property access. Matches the lazy DB
// pattern in `lib/db/client.ts`.
export const auth = new Proxy({} as RealAuth, {
  get(_target, prop, receiver) {
    return Reflect.get(getAuth(), prop, receiver);
  },
  has(_target, prop) {
    return Reflect.has(getAuth(), prop);
  }
});

export type AuthSession = Awaited<ReturnType<RealAuth["api"]["getSession"]>>;
