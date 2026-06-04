import * as SecureStore from "expo-secure-store";

/**
 * Round 20 — per-install device id.
 *
 * The Refine recipe service (R18) scopes one in-progress session per
 * `(mealId, userId, deviceId)` via a partial unique index. We need a
 * stable identifier that survives app restarts but doesn't leak across
 * installs (uninstall → reinstall = fresh sessions, which is the
 * intent). SecureStore keychain entries are wiped on uninstall on iOS
 * and Android, so they satisfy both ends of the contract.
 *
 * `crypto.randomUUID` is available in Hermes via RN 0.74+; the runtime
 * polyfill loads through `react-native-get-random-values` transitively
 * (most Expo SDK modules pull it in). If it's missing in some future
 * environment we fall back to a tagged time+random string — not as
 * collision-resistant but adequate for an opaque device tag.
 */

const DEVICE_ID_KEY = "eeatly.refineDeviceId";

let cached: string | null = null;

function generateId(): string {
  const g: { randomUUID?: () => string } | undefined =
    typeof globalThis !== "undefined"
      ? (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
      : undefined;
  if (g && typeof g.randomUUID === "function") {
    return g.randomUUID();
  }
  // Fallback: not RFC-4122 strict, but deterministic-shape and unique
  // enough for an opaque per-install tag. Stick to lowercase hex + dashes
  // so the backend's `deviceIdSchema.max(128)` is comfortably satisfied.
  const rand = Math.random().toString(36).slice(2);
  const time = Date.now().toString(36);
  return `${time}-${rand}-${rand.split("").reverse().join("")}`;
}

/**
 * Read (or lazily mint) the device id. Cached in-memory after the first
 * call so the SecureStore round-trip happens at most once per app
 * launch. Safe to call from anywhere; throws only if SecureStore itself
 * is unavailable (which would also fail the rest of auth, so the failure
 * mode is already handled upstream).
 */
export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing && existing.length > 0) {
    cached = existing;
    return existing;
  }
  const next = generateId();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, next, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK
  });
  cached = next;
  return next;
}

/**
 * Test-only escape hatch — lets specs wipe the cached id between cases.
 * Production code shouldn't call this; the device id is meant to live
 * for the install's lifetime.
 */
export function __resetDeviceIdCache(): void {
  cached = null;
}
