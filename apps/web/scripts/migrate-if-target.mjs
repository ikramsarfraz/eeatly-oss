// Applies Drizzle migrations during the Vercel build, but ONLY for the
// environments that own real data:
//   - production → `main` branch          → prod database
//   - uat        → `develop` preview build → uat database
// Every other context (feature-branch previews, local `pnpm build`) skips, so
// a random PR preview never mutates a real schema.
//
// Vercel sets VERCEL_ENV + VERCEL_GIT_COMMIT_REF during the build, and the
// environment's DATABASE_URL is injected from Vercel's env vars — the same
// connection the app uses. (Neon's pooled endpoint handles Drizzle's DDL fine,
// confirmed against the dev database, so no separate migration URL is needed.)

import { execSync } from "node:child_process";

const env = process.env.VERCEL_ENV; // production | preview | development | undefined (local)
const ref = process.env.VERCEL_GIT_COMMIT_REF; // git branch, on Vercel only

const isProd = env === "production";
const isUat = env === "preview" && ref === "develop";

if (!isProd && !isUat) {
  console.log(
    `[migrate] skip — not a migration target (VERCEL_ENV=${env ?? "local"}, branch=${ref ?? "n/a"}).`
  );
  process.exit(0);
}

const target = isProd ? "production" : "uat";

if (!process.env.DATABASE_URL) {
  console.error(
    `[migrate] DATABASE_URL is not set for ${target}. Add the Neon connection ` +
      `string to this environment in Vercel.`
  );
  process.exit(1);
}

console.log(`[migrate] applying pending migrations to ${target} database…`);
// drizzle.config.ts reads DATABASE_URL directly, so the migration runs against
// the same connection the app uses.
execSync("pnpm exec drizzle-kit migrate", { stdio: "inherit" });
console.log(`[migrate] ${target} is up to date.`);
