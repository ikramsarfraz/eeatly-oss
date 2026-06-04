/**
 * Admin-subdomain host detection.
 *
 * EDGE-SAFE: this module is imported by `proxy.ts` (middleware / edge
 * runtime), so it must NOT import `server-only`, the DB, or `getServerEnv`
 * (those pull in Node-only deps). It reads `process.env.ROOT_DOMAIN`
 * directly — the same approach fluxora's `tenant-host` uses.
 *
 * The model: eeatly serves the whole product on `ROOT_DOMAIN` and the
 * platform-admin surface on the `admin.` subdomain of it. Locally we use
 * `localtest.me` (a public domain that resolves `*.localtest.me` →
 * 127.0.0.1) so a parent-domain session cookie (`Domain=localtest.me`) is
 * valid and shared across subdomains — `admin.localhost` can't do that.
 *
 * When `ROOT_DOMAIN` is unset, every helper degrades to "no admin host"
 * and the app behaves exactly as before (single-origin, no subdomain).
 */

const ADMIN_SUBDOMAIN = "admin";

/** Normalized `ROOT_DOMAIN` (no protocol, no trailing slash), or null. */
export function getRootDomain(): string | null {
  const raw = process.env.ROOT_DOMAIN?.trim().toLowerCase();
  if (!raw) return null;
  const cleaned = raw.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return cleaned || null;
}

/** The admin hostname (no port), e.g. `admin.localtest.me` / `admin.eeatly.com`. */
export function getAdminHostname(rootDomain = getRootDomain()): string | null {
  return rootDomain ? `${ADMIN_SUBDOMAIN}.${rootDomain}` : null;
}

/** Strip the port (and normalize case) from a Host header value. */
export function hostnameOf(host: string): string {
  const h = host.trim().toLowerCase();
  // IPv6 literals contain ']' — leave them untouched.
  if (h.includes("]")) return h;
  const colon = h.lastIndexOf(":");
  return colon > 0 ? h.slice(0, colon) : h;
}

/**
 * True when the request Host is the admin subdomain of `ROOT_DOMAIN`.
 * Port-insensitive (local dev runs on :3003). Returns false when
 * `ROOT_DOMAIN` is unset.
 */
export function isAdminHost(
  host: string | null | undefined,
  rootDomain = getRootDomain()
): boolean {
  const adminHostname = getAdminHostname(rootDomain);
  if (!adminHostname || !host) return false;
  return hostnameOf(host) === adminHostname;
}

/**
 * Whether cross-subdomain session cookies should be enabled. Off for
 * `localhost`/`127.0.0.1` (browsers reject a shared `Domain` there) and when
 * `ROOT_DOMAIN` is unset.
 */
export function crossSubdomainCookiesEnabled(
  rootDomain = getRootDomain()
): boolean {
  return Boolean(
    rootDomain && rootDomain !== "localhost" && rootDomain !== "127.0.0.1"
  );
}
