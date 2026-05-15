import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { magicLink } from "better-auth/plugins";
import { db } from "@/lib/db/client";
import * as schema from "@/db/schema";
import { getServerEnv, hasGoogleAuthEnv } from "@/lib/env/server";
import { sendMagicLinkEmail } from "@/lib/email/resend";
import { logger } from "@/lib/observability/logger";
import { ensureHouseholdForUser } from "@/services/households";

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

function trustedOriginsList(): string[] {
  const fromEnv = [env.NEXT_PUBLIC_APP_URL, env.BETTER_AUTH_URL, appUrl].filter(Boolean);
  return [...new Set([...fromEnv, ...developmentLocalhostOrigins()])];
}

export const auth = betterAuth({
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
        after: async (user) => {
          try {
            await ensureHouseholdForUser(user.id, user.name ?? null);
          } catch (error) {
            logger.error("user_create_household_setup_failed", {
              userId: user.id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
    }
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60
    }
  },
  trustedOrigins: trustedOriginsList()
});

export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;
