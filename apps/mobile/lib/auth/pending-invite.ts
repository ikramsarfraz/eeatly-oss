import * as SecureStore from "expo-secure-store";

/**
 * Round 14 Task 4 — preserve an invite token across the magic-link
 * round-trip. Flow:
 *
 *   1. Signed-out user lands on `/invite/<token>` (deep link or web
 *      fallback).
 *   2. They tap "Sign in to accept"; we stash the invite token here
 *      and call Better Auth's magic-link sign-in with callbackURL
 *      `eeatly://verify`.
 *   3. Email arrives, they tap the link, `verify.tsx` exchanges the
 *      auth token for a session.
 *   4. verify.tsx reads this slot. If a token is pending, it routes
 *      back to `/invite/<token>` (now signed-in) and clears the slot.
 *
 * SecureStore + AFTER_FIRST_UNLOCK matches the session-token storage
 * policy — invite tokens are credential-equivalent.
 */
const KEY = "eeatly.pending_invite_token";

export async function setPendingInvite(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEY, token, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK
  });
}

export async function getPendingInvite(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function clearPendingInvite(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {
    /* best-effort */
  }
}
