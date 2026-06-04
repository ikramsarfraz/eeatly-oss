// Applies Drizzle migrations during the Vercel build, but ONLY for the
// environments that own real data:
//   - production → `main` branch          → prod database
//   - uat        → `develop` preview build → uat database
// Every other context (feature-branch previews, local `pnpm build`) skips, so
// a random PR preview never mutates a real schema.
//
// Vercel sets VERCEL_ENV + VERCEL_GIT_COMMIT_REF during the build, and the
// environment's DATABASE_MIGRATE_URL is injected from Vercel's env vars. We use
// the Neon DIRECT (unpooled) connection here on purpose: drizzle-kit runs DDL
// in a session and the pooled (`-pooler`) endpoint is unreliable for that. The
// app build/runtime keeps using the pooled DATABASE_URL — we only override it
// for the migration child process below.

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
const url = process.env.DATABASE_MIGRATE_URL;

if (!url) {
  console.error(
    `[migrate] DATABASE_MIGRATE_URL is not set for ${target}. Add the Neon DIRECT ` +
      `(unpooled, no "-pooler" in the host) connection string to this environment in Vercel.`
  );
  process.exit(1);
}

console.log(`[migrate] applying pending migrations to ${target} database…`);
execSync("pnpm exec drizzle-kit migrate", {
  stdio: "inherit",
  // drizzle.config.ts reads DATABASE_URL — point it at the direct URL just for
  // this run. The app's pooled DATABASE_URL is untouched for build + runtime.
  env: { ...process.env, DATABASE_URL: url }
});
console.log(`[migrate] ${target} is up to date.`);
