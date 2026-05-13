import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { magicLink } from "better-auth/plugins";
import { db } from "@/lib/db/client";
import * as schema from "@/db/schema";
import { getServerEnv, hasGoogleAuthEnv } from "@/lib/env/server";
import { sendMagicLinkEmail } from "@/lib/email/resend";

// Better Auth rejects server actions from origins not listed here.
// Dev often runs on alternate ports (:3001, …) while .env stays on :3000 — widen in development only.
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

function initAuth() {
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

  const trustedOrigins = [
    ...new Set(
      [env.NEXT_PUBLIC_APP_URL, env.BETTER_AUTH_URL, appUrl]
        .filter(Boolean)
        .concat(developmentLocalhostOrigins())
    )
  ];

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
        sendMagicLink: async ({ email, url }) => {
          await sendMagicLinkEmail(email, url);
        }
      })
    ],
    ...(socialProviders ? { socialProviders } : {}),
    user: {
      additionalFields: {
        role: {
          type: ["root_app_user", "tenant_user", "platform_admin"],
          required: false,
          defaultValue: "root_app_user",
          input: false
        },
        preferredTenantId: {
          type: "string",
          required: false,
          input: false
        }
      }
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60
      }
    },
    trustedOrigins
  });
}

type AuthInstance = ReturnType<typeof initAuth>;

let cached: AuthInstance | undefined;

// Lazy-initialized Better Auth instance. Defers betterAuth() invocation until
// first property access — `betterAuth()` registers internal hooks, middlewares,
// and an AsyncLocalStorage for session context, all of which contribute
// promise-tracking entries to Turbopack's HMR async-hooks Map in dev. Keeping
// this lazy means importing `auth` doesn't trigger that work at module-parse.
export const auth = new Proxy({} as AuthInstance, {
  get(_target, prop) {
    cached ??= initAuth();
    const value = Reflect.get(cached, prop, cached);
    return typeof value === "function" ? value.bind(cached) : value;
  }
});

export type AuthSession = Awaited<ReturnType<AuthInstance["api"]["getSession"]>>;
