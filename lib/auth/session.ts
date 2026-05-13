import "server-only";

import { cache } from "react";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { getServerEnv } from "@/lib/env/server";
import { logger } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/request-id";
import { householdMembers, households, users } from "@/db/schema";
import type { UserRole } from "@/types";

export type CurrentHousehold = {
  id: string;
  name: string;
};

export type AppUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: UserRole;
};

export async function getCurrentUser(): Promise<AppUser | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers()
    });

    if (!session?.user) {
      return null;
    }

    return {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
      role: (session.user.role as UserRole | undefined) ?? "root_app_user"
    };
  } catch (error) {
    // Distinguish "no session" (returns null naturally above) from a real
    // failure (DB outage, corrupted cookie, Better Auth internal crash).
    // Silently swallowing both makes outages look like sign-outs.
    logger.warn("session_lookup_failed", {
      requestId: (await getRequestId()) ?? undefined,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in");
  }

  return user;
}

export async function requirePlatformAdmin() {
  const user = await requireCurrentUser();
  const requestHeaders = await headers();
  const configuredAdminHost = getServerEnv().PLATFORM_ADMIN_HOST?.toLowerCase();
  const requestHost = (
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    ""
  ).toLowerCase();

  if (configuredAdminHost && requestHost !== configuredAdminHost) {
    notFound();
  }

  if (user.role !== "platform_admin") {
    notFound();
  }

  return user;
}

export async function requireApiUser() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  return user;
}

/**
 * Resolves the user's current household. Round-4 invariant: every user is in
 * exactly one household. Preferred path is via `users.preferred_household_id`;
 * falls back to a `household_members` lookup if the column is unset (shouldn't
 * happen post-migration but the membership row is the source of truth).
 *
 * Memoized per-request via React `cache()` — multiple calls in the same
 * request (server components + server actions + route handlers all share
 * the cache scope) hit the DB once.
 *
 * Throws if no household is found. The error message is user-facing so the
 * default Next error boundary surfaces it on the dashboard error page. This
 * state shouldn't exist after the 0015 backfill; if it fires, treat it as
 * data drift and check the `household_resolution_missing` log line.
 */
export const getCurrentHousehold = cache(
  async (userId: string): Promise<CurrentHousehold> => {
    const [userRow] = await db
      .select({ preferredHouseholdId: users.preferredHouseholdId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (userRow?.preferredHouseholdId) {
      const [hh] = await db
        .select({ id: households.id, name: households.name })
        .from(households)
        .where(eq(households.id, userRow.preferredHouseholdId))
        .limit(1);
      if (hh) return hh;
    }

    // Fallback: find the user's membership row. The single-column unique
    // on household_members.user_id guarantees at most one result.
    const [member] = await db
      .select({ id: households.id, name: households.name })
      .from(householdMembers)
      .innerJoin(households, eq(householdMembers.householdId, households.id))
      .where(eq(householdMembers.userId, userId))
      .limit(1);

    if (member) {
      // Self-heal the preferred pointer so the next request takes the fast
      // path. Don't await: hygiene only, failure is non-fatal.
      void db
        .update(users)
        .set({ preferredHouseholdId: member.id, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .catch(() => {
          /* swallow — best-effort repair */
        });
      return member;
    }

    logger.error("household_resolution_missing", {
      requestId: (await getRequestId()) ?? undefined,
      userId
    });
    throw new Error("Your account isn't linked to a household — contact support.");
  }
);

/**
 * Verifies the user belongs to the given household. Throws if not. Logs
 * cross-household access attempts at error level — these shouldn't happen
 * through normal app flows; if one fires, treat it as a bug or an attack.
 *
 * Memoized per-request via React `cache()`. Service functions call this at
 * the top of every household-scoped operation; without memoization, a single
 * request that touches three services would do three identical SELECTs.
 */
export const requireHouseholdMember = cache(
  async (userId: string, householdId: string): Promise<void> => {
    const [member] = await db
      .select({ id: householdMembers.id })
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.userId, userId),
          eq(householdMembers.householdId, householdId)
        )
      )
      .limit(1);

    if (!member) {
      logger.error("unauthorized_household_access", {
        requestId: (await getRequestId()) ?? undefined,
        userId,
        requestedHouseholdId: householdId
      });
      throw new Error("Not authorized for this household.");
    }
  }
);

/**
 * Convenience for routes/actions that need both. Two queries today;
 * Task 3 collapses them into one memoized lookup.
 */
export async function requireCurrentUserWithHousehold() {
  const user = await requireCurrentUser();
  const household = await getCurrentHousehold(user.id);
  return { user, household };
}
