"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireCurrentUser } from "@/lib/auth/session";
import { logger } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/request-id";
import { checkMealMutationLimit } from "@/lib/security/rate-limit";
import { deleteUserAccount } from "@/services/account";

const CONFIRMATION_PHRASE = "delete my account";

/**
 * Deletes the caller's account. Requires the user to type the exact
 * confirmation phrase (case- and whitespace-insensitive) on the client
 * — this is intentionally not just a button click. The phrase doesn't
 * need to be a secret; it's about avoiding accidental destructive
 * clicks.
 *
 * After deletion, signs out the Better Auth session and redirects to
 * the sign-in page. The redirect throws NEXT_REDIRECT so anything
 * downstream of this call won't execute.
 */
export async function deleteAccountAction(confirmationPhrase: string) {
  const user = await requireCurrentUser();
  // Reuse the meal-mutation budget — this is a one-shot operation per
  // user but the rate limiter also serves as a brute-force throttle
  // against scripted attempts.
  await checkMealMutationLimit(user.id);

  const normalized = confirmationPhrase.trim().toLowerCase();
  if (normalized !== CONFIRMATION_PHRASE) {
    throw new Error(
      `Type "${CONFIRMATION_PHRASE}" exactly to confirm.`
    );
  }

  const requestId = (await getRequestId()) ?? undefined;
  logger.info("account_delete_requested", { userId: user.id, requestId });

  // Sign out before deleting so the session is invalidated even if the
  // delete itself fails — leaves the user logged out rather than zombie-
  // session'd.
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch (error) {
    logger.warn("account_delete_signout_failed", {
      userId: user.id,
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
  }

  await deleteUserAccount(user.id);

  redirect("/sign-in?deleted=1");
}
