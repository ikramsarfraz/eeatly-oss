"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireCurrentUser } from "@/lib/auth/session";
import { sendAccountDeletedEmail } from "@/lib/email/transactional";
import { logger } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/request-id";
import { checkMealMutationLimit } from "@/lib/security/rate-limit";
import { deleteUserAccount } from "@/services/account";
import { userOwnsMultiMemberHousehold } from "@/services/households";

const CONFIRMATION_PHRASE = "delete my account";

/**
 * Discriminated-union return matching the Round 4 action pattern. The
 * `ok: true` branch exists for type completeness — in practice the action
 * always redirects on success, so callers never observe it. Failures
 * resolve cleanly to a `code` the UI can branch on without inspecting
 * error messages.
 */
export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; code: "OWNER_BLOCK" }
  | { ok: false; code: "OTHER"; message: string };

/**
 * Deletes the caller's account. Requires the user to type the exact
 * confirmation phrase (case- and whitespace-insensitive) on the client
 * — this is intentionally not just a button click. The phrase doesn't
 * need to be a secret; it's about avoiding accidental destructive
 * clicks.
 *
 * On success, signs out the Better Auth session and redirects to the
 * sign-in page. The redirect throws NEXT_REDIRECT and short-circuits
 * everything downstream, so the `ok: true` return is unreachable in
 * practice — kept in the type for symmetry with other actions.
 *
 * The owner-of-multi-member-household guard resolves to `OWNER_BLOCK` so
 * the UI can show a dedicated message (transfer-ownership path) instead
 * of a generic error. Rate-limit and infra failures still throw — the
 * client treats them the same way it treats any other action throw.
 */
export async function deleteAccountAction(
  confirmationPhrase: string
): Promise<DeleteAccountResult> {
  const user = await requireCurrentUser();
  // Reuse the meal-mutation budget — this is a one-shot operation per
  // user but the rate limiter also serves as a brute-force throttle
  // against scripted attempts.
  await checkMealMutationLimit(user.id);

  const normalized = confirmationPhrase.trim().toLowerCase();
  if (normalized !== CONFIRMATION_PHRASE) {
    return {
      ok: false,
      code: "OTHER",
      message: `Type "${CONFIRMATION_PHRASE}" exactly to confirm.`
    };
  }

  // Round-4 guard: owners of multi-member households can't be deleted
  // without first transferring ownership — cascade-deleting the user
  // would orphan or wipe the household for the remaining members. The
  // service-layer `OwnerAccountDeletionBlockedError` still exists as
  // forward-defense for other code paths; the action checks the
  // boolean and converts to the discriminated-union code directly
  // here so we don't round-trip through an Error class.
  if (await userOwnsMultiMemberHousehold(user.id)) {
    return { ok: false, code: "OWNER_BLOCK" };
  }

  const requestId = (await getRequestId()) ?? undefined;
  logger.info("account_delete_requested", { userId: user.id, requestId });

  // Round 9 — send the confirmation email BEFORE tearing down the row.
  // After deletion, the user's email + name are gone (the row cascades
  // through every reference), so we'd have nothing to send to. The send
  // is best-effort: a failure here can't block the deletion the user
  // actually requested.
  try {
    await sendAccountDeletedEmail(user.email, user.name ?? "there", user.id);
  } catch (error) {
    logger.warn("account_delete_confirmation_email_failed", {
      userId: user.id,
      requestId,
      error: error instanceof Error ? error.message : String(error)
    });
  }

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
