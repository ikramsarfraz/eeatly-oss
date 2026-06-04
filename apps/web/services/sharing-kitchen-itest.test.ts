/**
 * Opt-in integration smoke (real Neon DB, no mocks). Seeds two users in one
 * household + a recipe, exercises the kitchen-mate sharing path end to end,
 * then cleans up. INERT by default — it only runs when ITEST_DB=1, so the
 * normal `pnpm test` never touches the database. Run it yourself with:
 *   ITEST_DB=1 pnpm vitest run services/sharing-kitchen-itest.test.ts
 * ⚠️ It INSERTs + DELETEs rows in whatever DATABASE_URL your .env.local
 * points at — confirm that's a dev/throwaway branch, not production, first.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ENABLED = process.env.ITEST_DB === "1";

// Load .env.local into process.env BEFORE the db client module is imported
// (the db client reads DATABASE_URL at first use). Static service imports are
// avoided for the same reason — everything is dynamically imported in beforeAll.
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
type Sharing = typeof import("./sharing");

let db: DbModule["db"];
let schema: Schema;
let sharing: Sharing;

const aId = `itest-A-${randomUUID()}`;
const bId = `itest-B-${randomUUID()}`;
let householdId = "";
let mealId = "";

beforeAll(async () => {
  if (!ENABLED) return;
  loadEnvLocal();
  [{ db }, schema, sharing] = await Promise.all([
    import("@/lib/db/client"),
    import("@/db/schema"),
    import("./sharing")
  ]);
  const { users, households, householdMembers, meals } = schema;

  await db.insert(users).values([
    { id: aId, name: "Itest A", email: `${aId}@itest.local` },
    { id: bId, name: "Itest B", email: `${bId}@itest.local` }
  ]);
  const [h] = await db
    .insert(households)
    .values({ name: "Itest Kitchen", ownerId: aId })
    .returning({ id: households.id });
  householdId = h!.id;
  await db.insert(householdMembers).values([
    { householdId, userId: aId, role: "owner" },
    { householdId, userId: bId, role: "member" }
  ]);
  await db
    .update(users)
    .set({ preferredHouseholdId: householdId })
    .where(inArray(users.id, [aId, bId]));
  const dishName = `Itest Dish ${aId.slice(-6)}`;
  const [m] = await db
    .insert(meals)
    .values({
      householdId,
      createdByUserId: aId,
      name: dishName,
      normalizedName: dishName.toLowerCase()
    })
    .returning({ id: meals.id });
  mealId = m!.id;
});

afterAll(async () => {
  if (!ENABLED || !db) return;
  const { itemGrants, meals, householdMembers, households, users } = schema;
  // Order: grants → meal → memberships → household → users (FK-safe).
  await db.delete(itemGrants).where(eq(itemGrants.itemId, mealId)).catch(() => {});
  await db.delete(meals).where(eq(meals.id, mealId)).catch(() => {});
  await db
    .delete(householdMembers)
    .where(eq(householdMembers.householdId, householdId))
    .catch(() => {});
  await db.delete(households).where(eq(households.id, householdId)).catch(() => {});
  // Deleting the users cascades any stray notification/grant rows.
  await db.delete(users).where(inArray(users.id, [aId, bId])).catch(() => {});
});

describe.skipIf(!ENABLED)("kitchen-mate sharing (real DB)", () => {
  it("a kitchen co-member is an eligible share target without a connection", async () => {
    expect(await sharing.canShareWith(aId, bId)).toBe(true);
    const targets = await sharing.listShareTargets(aId);
    expect(targets.map((t) => t.userId)).toContain(bId);
  });

  it("someone with no shared kitchen and no connection is NOT eligible", async () => {
    expect(await sharing.canShareWith(aId, `itest-stranger-${randomUUID()}`)).toBe(false);
  });

  it("owner grants a recipe to the kitchen-mate; it lands in their Shared-with-me", async () => {
    const { grantId } = await sharing.grantItem({
      ownerUserId: aId,
      itemType: "recipe",
      itemId: mealId,
      granteeUserId: bId
    });
    expect(grantId).toBeTruthy();

    const shared = await sharing.listSharedWithMe(bId);
    const got = shared.find((s) => s.itemId === mealId);
    expect(got).toBeTruthy();
    expect(got?.ownerUserId).toBe(aId);
    // Recipes stay private: B sees ONLY the explicitly granted item.
    expect(shared.every((s) => s.itemId === mealId)).toBe(true);
  });
});
