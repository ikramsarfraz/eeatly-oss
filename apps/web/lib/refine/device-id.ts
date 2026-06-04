/**
 * Round 22 — per-install device id for the Refine flow.
 *
 * Mobile uses SecureStore (apps/mobile/lib/device-id.ts); web's
 * equivalent is a UUID v4 persisted in localStorage. The backend
 * `refine_sessions` table has a partial unique index over
 * `(meal_id, user_id, device_id) where status='active'` — so the
 * id needs to survive page reloads but doesn't have to be the same
 * across browsers / incognito sessions. Clearing site storage gets
 * a new device id, which is acceptable (the server will mint a fresh
 * session against the new id).
 *
 * `crypto.randomUUID` is available in all evergreen browsers (and
 * required by the validator's `deviceIdSchema.max(128)`, which a UUID
 * comfortably satisfies). SSR-safe: returns an empty string when
 * `window` is undefined, so the helper can be referenced from
 * client-component module bodies without crashing during the SSR
 * pre-render.
 */
import { randomUuid } from "@/lib/utils";

const DEVICE_ID_KEY = "eeatly:device-id";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    // `randomUuid` (not crypto.randomUUID) so it also works on non-secure dev
    // hosts like http://localtest.me, where crypto.randomUUID is undefined.
    id = randomUuid();
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}
