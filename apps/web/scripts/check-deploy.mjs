#!/usr/bin/env node
/**
 * Production readiness checks for server-side env (never prints secret values).
 * Loads `.env.local` then `.env` from the project root when present.
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

for (const name of [".env.local", ".env"]) {
  const full = path.join(root, name);
  if (fs.existsSync(full)) {
    dotenv.config({ path: full, override: false });
  }
}

function setAndNonEmpty(key) {
  const v = process.env[key];
  return typeof v === "string" && v.trim().length > 0;
}

function reportPresence(key, options = {}) {
  const { minLen } = options;
  const ok = setAndNonEmpty(key);
  if (!ok) {
    return { ok: false, line: `${key}: missing` };
  }
  const len = String(process.env[key]).length;
  if (minLen !== undefined && len < minLen) {
    return { ok: false, line: `${key}: too short (need >= ${minLen} chars, has ${len})` };
  }
  return { ok: true, line: `${key}: set` };
}

const r2Keys = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL"
];

const required = [
  ["DATABASE_URL", {}],
  ["BETTER_AUTH_URL", {}],
  ["NEXT_PUBLIC_APP_URL", {}],
  ["BETTER_AUTH_SECRET", { minLen: 32 }],
  ["RESEND_API_KEY", {}],
  ["EMAIL_FROM", {}]
];

console.log("CookLoop deploy check\n");

const lines = [];
let failed = false;

for (const [key, opts] of required) {
  const r = reportPresence(key, opts);
  lines.push(r.line);
  if (!r.ok) failed = true;
}

const webhook = setAndNonEmpty("RESEND_WEBHOOK_SECRET");
lines.push(
  `RESEND_WEBHOOK_SECRET: ${webhook ? "set (webhook ingestion enabled)" : "not set (POST /api/webhooks/resend returns 503 until configured)"}`
);

const r2Present = r2Keys.map((k) => setAndNonEmpty(k));
const r2Count = r2Present.filter(Boolean).length;
if (r2Count === 0) {
  lines.push("R2: disabled — photo uploads will return a configuration error until all R2_* vars are set");
} else if (r2Count === r2Keys.length) {
  lines.push("R2: fully configured");
} else {
  failed = true;
  const missing = r2Keys.filter((k) => !setAndNonEmpty(k));
  lines.push(`R2: partially configured (${r2Count}/${r2Keys.length}) — missing: ${missing.join(", ")}`);
}

// Stripe paid tier — all-or-none, same as R2. When none are set the app
// runs in launch mode (Plus free for everyone); when all are set, paid
// checkout goes live and launch free-access auto-disables. A PARTIAL
// config is a hard failure: a half-wired Stripe is the one state that
// silently breaks checkout, so we block the deploy on it.
const stripeKeys = [
  "STRIPE_SECRET_KEY",
  "STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_MONTHLY",
  "STRIPE_PRICE_ANNUAL"
];
const stripeCount = stripeKeys.filter((k) => setAndNonEmpty(k)).length;
if (stripeCount === 0) {
  lines.push(
    "Stripe: not configured — launch mode active (Plus free for everyone). Set all STRIPE_* vars to turn on paid checkout."
  );
} else if (stripeCount === stripeKeys.length) {
  lines.push(
    "Stripe: fully configured — paid checkout active; launch free-access auto-disabled (unless LAUNCH_FREE_ACCESS=true)."
  );
} else {
  failed = true;
  const missing = stripeKeys.filter((k) => !setAndNonEmpty(k));
  lines.push(
    `Stripe: partially configured (${stripeCount}/${stripeKeys.length}) — missing: ${missing.join(", ")}`
  );
}

const launchOverride = process.env.LAUNCH_FREE_ACCESS;
if (launchOverride === "true" || launchOverride === "false") {
  lines.push(`LAUNCH_FREE_ACCESS: ${launchOverride} (explicit override of the default)`);
}

lines.push(
  `PLATFORM_ADMIN_HOST: ${setAndNonEmpty("PLATFORM_ADMIN_HOST") ? "set (admin routes additionally gated by host)" : "not set (admin uses session + role only)"}`
);

const nodeEnv = process.env.NODE_ENV ?? "(unset)";
lines.push(`NODE_ENV: ${nodeEnv}`);

if (nodeEnv === "production") {
  lines.push(
    "Note: NODE_ENV=production — ensure this check runs against the same env as your host (e.g. Vercel env preview vs production)."
  );
}

for (const line of lines) {
  console.log(`  ${line}`);
}

console.log("");

if (failed) {
  console.error("check:deploy: FAILED — fix required variables before production.");
  process.exit(1);
}

console.log("check:deploy: OK — required variables present.");
process.exit(0);
