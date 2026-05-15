import * as SecureStore from "expo-secure-store";

/**
 * Round 12 — session-token persistence wrapper. Better Auth issues a
 * bearer token on successful sign-in (via the `set-auth-token` response
 * header, exposed by the Round 12 bearer plugin); mobile stores it in
 * `expo-secure-store` so subsequent app launches stay signed in
 * without re-authenticating.
 *
 * `expo-secure-store` is platform-keychain-backed (iOS Keychain,
 * Android Keystore). Auth tokens MUST NOT live in AsyncStorage — it's
 * plain unencrypted JSON on the device's filesystem and apps in the
 * same userland could read it.
 */
const SESSION_TOKEN_KEY = "eeatly.session_token";

export async function getSessionToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  } catch {
    // Locked keychain (device not yet unlocked since boot), corrupted
    // keystore entry — anything unexpected is treated as "no session"
    // so the user just signs in again. We never throw on read.
    return null;
  }
}

export async function setSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK
  });
}

export async function clearSessionToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  } catch {
    // Best-effort. The UI calls this on sign-out + on any auth error
    // that hints at an invalidated token; a SecureStore failure here
    // shouldn't keep the user "signed in."
  }
}
