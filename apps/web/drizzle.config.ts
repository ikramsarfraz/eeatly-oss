import { config as loadEnv } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { resolveDatabaseUrlForApp } from "./db/database-url";

// drizzle-kit does not read Next.js env files by default; mirror Next precedence.
loadEnv({ path: ".env" });
loadEnv({ path: ".env.local", override: true });

const databaseUrl = resolveDatabaseUrlForApp();

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl
  },
  strict: true,
  verbose: true
});
