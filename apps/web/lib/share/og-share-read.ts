import "server-only";

import { Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import { meals, planShares, plans, recipeShares } from "@/db/schema";
import { getDatabaseUrl } from "@/lib/env/server";

/**
 * Lean, env-guard-free read path for the public share-OG card
 * (`app/share/[token]/opengraph-image.tsx`).
 *
 * The card only needs a token -> {recipe|plan, name} resolution with the same
 * revoked/archived visibility rules as the live `/share` page. The full
 * `services/shares` path reaches the shared `db` client, which calls
 * `getServerEnv()` and so requires every server var (including the AI keys) on
 * first query. An unrelated missing `ANTHROPIC_API_KEY` would then take down
 * share-card rendering and makes the route untestable locally. This module
 * opens its own pool from just `DATABASE_URL` (via `getDatabaseUrl()`), so no
 * AI key is involved. It does NOT change `services/shares` or `lib/db/client`,
 * so the `/share` page behavior is unchanged.
 *
 * Read-only and public: NO auth check. The token is the access control,
 * exactly as in `services/shares.ts`.
 */

let cached: NeonDatabase<typeof schema> | null = null;

function ogDb(): NeonDatabase<typeof schema> {
  if (cached) return cached;
  cached = drizzle(new Pool({ connectionString: getDatabaseUrl() }), { schema });
  return cached;
}

export type OgShareCard = {
  kind: "recipe" | "plan";
  name: string;
};

/**
 * Resolve a public share token to the card's kind + display name, or `null`
 * for unknown / revoked / archived tokens (the route turns `null` into a 404
 * so no card leaks). Recipe first, then plan, matching the page's precedence.
 */
export async function getOgShareCard(token: string): Promise<OgShareCard | null> {
  const db = ogDb();

  const [recipe] = await db
    .select({
      revokedAt: recipeShares.revokedAt,
      name: meals.name,
      archivedAt: meals.archivedAt
    })
    .from(recipeShares)
    .innerJoin(meals, eq(meals.id, recipeShares.mealId))
    .where(eq(recipeShares.token, token))
    .limit(1);
  if (recipe && !recipe.revokedAt && !recipe.archivedAt) {
    return { kind: "recipe", name: recipe.name };
  }

  const [plan] = await db
    .select({
      revokedAt: planShares.revokedAt,
      name: plans.name,
      archivedAt: plans.archivedAt
    })
    .from(planShares)
    .innerJoin(plans, eq(plans.id, planShares.planId))
    .where(eq(planShares.token, token))
    .limit(1);
  if (plan && !plan.revokedAt && !plan.archivedAt) {
    return { kind: "plan", name: plan.name };
  }

  return null;
}
