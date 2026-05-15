/**
 * Round 12 — single source of truth for the API base URL.
 *
 * `EXPO_PUBLIC_API_BASE_URL` is read at build time by Expo and embedded
 * in the bundle. Set it in `apps/mobile/.env` (development) or via EAS
 * Build secrets / app config (production):
 *
 *   EXPO_PUBLIC_API_BASE_URL=https://eeatly.app
 *
 * Dev fallback is the LAN-accessible Next.js URL — mobile simulators
 * + physical devices can't reach `localhost`, so the user typically
 * sets this to the Mac's LAN IP (e.g. `http://192.168.1.42:3000`).
 */
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

export const TRPC_URL = `${API_BASE_URL}/api/trpc`;
export const AUTH_URL = `${API_BASE_URL}/api/auth`;
