import "server-only";

import { and, eq, isNotNull } from "drizzle-orm";
import { accounts, users } from "@/db/schema";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";

/**
 * Whether the user has an email + password credential. Better Auth stores it as
 * an `account` row with providerId "credential" and a non-null password hash.
 * Magic-link- or Google-only users return false: they have no current password
 * to verify, so the change-password form is hidden for them (they set one via
 * the reset link instead).
 */
export async function userHasPassword(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(
      and(
        eq(accounts.userId, userId),
        eq(accounts.providerId, "credential"),
        isNotNull(accounts.password)
      )
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Hard-deletes the user's row. Cascading FK constraints clean up auth
 * (accounts, sessions), meals + logs, feedback, and notifications.
 * `analytics_events` and `email_delivery_logs` keep their rows with
 * `user_id` nulled — preserves deidentified aggregates without leaking
 * the deleted user's identity.
 *
 * The verification token of an in-flight magic link (if any) also gets
 * left alone — Better Auth's `verification` table doesn't reference user
 * by FK (the link is keyed by email + token only), and a stale row is
 * harmless: the email account is already gone.
 *
 * Returns true if a row was deleted, false if no user existed with that id.
 * Idempotent — calling twice succeeds, second call returns false.
 */
export async function deleteUserAccount(userId: string): Promise<boolean> {
  try {
    const deleted = await db
      .delete(users)
      .where(eq(users.id, userId))
      .returning({ id: users.id });

    if (deleted.length === 0) {
      return false;
    }

    logger.info("account_deleted", { userId });
    return true;
  } catch (error) {
    logger.error("account_delete_failed", {
      userId,
      error: error instanceof Error ? error.message : String(error)
    });
    throw new Error("Couldn't delete your account. Please try again.");
  }
}
