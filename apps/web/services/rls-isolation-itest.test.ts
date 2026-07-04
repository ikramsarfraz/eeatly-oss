/**
 * Opt-in RLS enforcement integration test (real Neon DB, no mocks).
 *
 * Verifies the database actually enforces isolation under the RESTRICTED role —
 * i.e. that the policies in db/rls/*.sql are applied and working. Distinct from
 * sharing-kitchen-itest.test.ts (which tests the service layer through the
 * privileged connection).
 *
 * INERT unless BOTH:
 *   - ITEST_RLS=1
 *   - DATABASE_URL_APP points at the restricted role, and db/rls/*.sql are
 *     applied to that database.
 * Run with:
 *   ITEST_RLS=1 pnpm vitest run services/rls-isolation-itest.test.ts
 * ⚠️ INSERTs + DELETEs rows in DATABASE_URL / DATABASE_URL_APP — use a
 * dev/throwaway branch, never production.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Pool } from "@neondatabase/serverless";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ENABLED = process.env.ITEST_RLS === "1";

function loadEnvLocal() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eqAt = line.indexOf("=");
    if (eqAt === -1) continue;
    const key = line.slice(0, eqAt).trim();
    let val = line.slice(eqAt + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

type DbModule = typeof import("@/lib/db/client");
type Schema = typeof import("@/db/schema");

let dbPrivileged: DbModule["dbPrivileged"];
let schema: Schema;

const aId = `itest-rls-A-${randomUUID()}`;
const bId = `itest-rls-B-${randomUUID()}`;
let householdA = "";
let householdB = "";
let privateMealId = "";
let sharedMealId = "";

// Run a query as the RESTRICTED role with `app.current_user_id` = userId, the
// same shape withRlsContext sets up in production.
async function asUser<T>(userId: string, sql: string, params: unknown[]): Promise<T[]> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL_APP });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("select set_config('app.current_user_id', $1, true)", [userId]);
    const res = await client.query(sql, params);
    await client.query("ROLLBACK");
    return res.rows as T[];
  } finally {
    client.release();
    await pool.end();
  }
}

beforeAll(async () => {
  if (!ENABLED) return;
  loadEnvLocal();
  if (!process.env.DATABASE_URL_APP) {
    throw new Error("ITEST_RLS=1 requires DATABASE_URL_APP (the restricted role).");
  }
  [{ dbPrivileged }, schema] = await Promise.all([
    import("@/lib/db/client"),
    import("@/db/schema")
  ]);
  const { users, households, householdMembers, meals, mealLogs, itemGrants } = schema;

  // Seed through the PRIVILEGED connection (the restricted role can't, by design).
  await dbPrivileged.insert(users).values([
    { id: aId, name: "RLS A", email: `${aId}@itest.local` },
    { id: bId, name: "RLS B", email: `${bId}@itest.local` }
  ]);
  const [ha] = await dbPrivileged
    .insert(households)
    .values({ name: "RLS Kitchen A", ownerId: aId })
    .returning({ id: households.id });
  const [hb] = await dbPrivileged
    .insert(households)
    .values({ name: "RLS Kitchen B", ownerId: bId })
    .returning({ id: households.id });
  householdA = ha!.id;
  householdB = hb!.id;
  await dbPrivileged.insert(householdMembers).values([
    { householdId: householdA, userId: aId, role: "owner" },
    { householdId: householdB, userId: bId, role: "owner" }
  ]);

  const priv = `RLS Private ${aId.slice(-6)}`;
  const shared = `RLS Shared ${aId.slice(-6)}`;
  const [pm] = await dbPrivileged
    .insert(meals)
    .values({ householdId: householdA, createdByUserId: aId, name: priv, normalizedName: priv.toLowerCase() })
    .returning({ id: meals.id });
  const [sm] = await dbPrivileged
    .insert(meals)
    .values({ householdId: householdA, createdByUserId: aId, name: shared, normalizedName: shared.toLowerCase() })
    .returning({ id: meals.id });
  privateMealId = pm!.id;
  sharedMealId = sm!.id;

  // A logged a cook on the private meal (personal history).
  await dbPrivileged.insert(mealLogs).values({
    mealId: privateMealId,
    householdId: householdA,
    cookedByUserId: aId,
    cookedAt: "2026-06-18",
    effortLevel: "medium"
  });

  // A shares the second meal with B (view grant).
  await dbPrivileged.insert(itemGrants).values({
    itemType: "recipe",
    itemId: sharedMealId,
    ownerUserId: aId,
    granteeUserId: bId,
    role: "view"
  });
});

afterAll(async () => {
  if (!ENABLED || !householdA) return;
  const { users, households, meals, mealLogs, itemGrants } = schema;
  await dbPrivileged.delete(itemGrants).where(inArray(itemGrants.itemId, [privateMealId, sharedMealId]));
  await dbPrivileged.delete(mealLogs).where(inArray(mealLogs.mealId, [privateMealId, sharedMealId]));
  await dbPrivileged.delete(meals).where(inArray(meals.id, [privateMealId, sharedMealId]));
  await dbPrivileged.delete(households).where(inArray(households.id, [householdA, householdB]));
  await dbPrivileged.delete(users).where(inArray(users.id, [aId, bId]));
});

describe.runIf(ENABLED)("RLS enforcement (restricted role)", () => {
  it("B cannot read A's private meal", async () => {
    const rows = await asUser<{ id: string }>(bId, "select id from meals where id = $1", [privateMealId]);
    expect(rows).toHaveLength(0);
  });

  it("B cannot read A's cook logs", async () => {
    const rows = await asUser(bId, "select id from meal_logs where meal_id = $1", [privateMealId]);
    expect(rows).toHaveLength(0);
  });

  it("B CAN read a meal A shared with them", async () => {
    const rows = await asUser<{ id: string }>(bId, "select id from meals where id = $1", [sharedMealId]);
    expect(rows).toHaveLength(1);
  });

  it("A sees their own private meal + log", async () => {
    const meals = await asUser<{ id: string }>(aId, "select id from meals where id = $1", [privateMealId]);
    const logs = await asUser(aId, "select id from meal_logs where meal_id = $1", [privateMealId]);
    expect(meals).toHaveLength(1);
    expect(logs).toHaveLength(1);
  });

  it("the privileged connection still sees everything (system path)", async () => {
    const { meals } = schema;
    const all = await dbPrivileged.select({ id: meals.id }).from(meals).where(inArray(meals.id, [privateMealId, sharedMealId]));
    expect(all).toHaveLength(2);
  });
});
