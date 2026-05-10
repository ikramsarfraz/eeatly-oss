import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { magicLink } from "better-auth/plugins";
import { db } from "@/lib/db/client";
import * as schema from "@/db/schema";
import { getServerEnv } from "@/lib/env/server";
import { sendMagicLinkEmail } from "@/lib/email/resend";

const env = getServerEnv();
const appUrl = env.BETTER_AUTH_URL;

export const auth = betterAuth({
  appName: "CookLoop",
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
  trustedOrigins: [env.NEXT_PUBLIC_APP_URL, env.BETTER_AUTH_URL, appUrl]
});

export type AuthSession = Awaited<ReturnType<typeof auth.api.getSession>>;
