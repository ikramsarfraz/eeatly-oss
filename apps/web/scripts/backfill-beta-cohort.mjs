#!/usr/bin/env node
/**
 * Round 6 backfill: grant every user without a beta_cohort the `beta_2026`
 * cohort, so existing accounts retain access when the feature gates ship.
 *
 * Lives outside `drizzle/` because Postgres rejects using a new enum value
 * (`ALTER TYPE … ADD VALUE 'beta_2026'`) in the same transaction it was added
 * in, and drizzle's migrator wraps the pending batch in one transaction.
 *
 * Idempotent: only touches rows where beta_cohort IS NULL. Safe to re-run.
 *
 * Deploy order: `pnpm db:migrate` first (commits the enum value), then
 * `pnpm db:backfill:beta-cohort`.
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

for (const name of [".env.local", ".env"]) {
  const full = path.join(root, name);
  if (fs.existsSync(full)) {
    dotenv.config({ path: full, override: false });
  }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

const sql = neon(databaseUrl);

const updated = await sql`
  UPDATE "user"
  SET "beta_cohort" = 'beta_2026'
  WHERE "beta_cohort" IS NULL
  RETURNING id
`;

console.log(`Granted beta_2026 to ${updated.length} user(s).`);
