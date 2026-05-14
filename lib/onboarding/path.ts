import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { households, householdMembers } from "@/db/schema";

/**
 * Round 9 — determine which onboarding flow a user should see.
 *
 *  - `fresh`: a brand-new user signing up to start their own kitchen.
 *    Sees the full flow (welcome → habits → optional first meal → done)
 *    with the soft "invite family" suggestion at the end.
 *
 *  - `invited`: a user who accepted a household invitation. The kitchen
 *    already exists with content, so the full preference + first-meal
 *    flow feels weird. They see a shorter flow (welcome → habits → done)
 *    plus a welcome toast on the dashboard naming the kitchen.
 *
 * Detection is in-memory rather than a new column on `users` so we
 * don't ship schema changes this round. The signal: does the user
 * own their household? If `households.ownerId === user.id` they
 * created it (fresh); otherwise they were added to someone else's
 * kitchen via the invitation flow (invited).
 *
 * If the user has no household yet (this shouldn't happen post-0015
 * backfill, but the fallback covers race conditions during signup),
 * we default to `fresh` — that's the safer assumption for a
 * brand-new user.
 */
export type OnboardingPath = "fresh" | "invited";

export type OnboardingPathContext = {
  path: OnboardingPath;
  /** The user's kitchen name. Used in the welcome step + dashboard toast
   *  for invited users; "your kitchen" fallback if unavailable. */
  householdName: string | null;
};

export async function resolveOnboardingPath(userId: string): Promise<OnboardingPathContext> {
  // Prefer the cached pointer; fall back to the membership row. We
  // INNER JOIN through household_members rather than reading
  // `users.preferredHouseholdId` so a stale-pointer user (rare; would
  // only happen if a household was hard-deleted out from under them)
  // still gets a correct answer.
  const [row] = await db
    .select({
      ownerId: households.ownerId,
      householdName: households.name
    })
    .from(householdMembers)
    .innerJoin(households, eq(householdMembers.householdId, households.id))
    .where(eq(householdMembers.userId, userId))
    .limit(1);

  if (!row) {
    // No household yet — getCurrentHousehold's self-heal will create one
    // on the next request. Default to `fresh` since they're acting like
    // a new signup.
    return { path: "fresh", householdName: null };
  }

  return {
    path: row.ownerId === userId ? "fresh" : "invited",
    householdName: row.householdName
  };
}
