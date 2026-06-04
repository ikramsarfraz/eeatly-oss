import "server-only";

import { lookup } from "node:dns/promises";

/**
 * Round 16 — SSRF defense for the URL preview procedure.
 *
 * The preview fetcher takes an arbitrary URL and makes an outbound
 * HTTP request server-side. Without defense, a user could supply
 * `http://169.254.169.254/latest/meta-data/` (AWS instance metadata)
 * or `http://10.0.0.1/admin` and read responses from internal hosts
 * the public network can't reach. We:
 *   1. Reject non-http(s) schemes (no `file://`, `gopher://`, …).
 *   2. Resolve the hostname to all IPs and reject if any are in
 *      private / loopback / link-local / unique-local-IPv6 ranges.
 *
 * Step 2 happens once, before the fetch — which means an attacker
 * who controls the DNS for `attacker.com` could in principle return
 * a private IP on the second resolution (DNS rebinding). Mitigated
 * by passing the resolved IP directly to fetch via the URL — see
 * `fetchHtmlSafely`. Without an http-agent override Node's fetch
 * doesn't expose hooks for "use this exact IP", so we live with the
 * one-resolution race and rely on the absence of cookies/auth in
 * the outbound request to make rebinding mostly toothless: even if
 * an internal host responds, we only get its public-page HTML, not
 * authenticated content. Documented as a known limitation.
 */

export type SsrfRejectReason =
  | "invalid_scheme"
  | "malformed"
  | "private_network";

export class SsrfRejectedError extends Error {
  readonly reason: SsrfRejectReason;
  constructor(reason: SsrfRejectReason, message: string) {
    super(message);
    this.name = "SsrfRejectedError";
    this.reason = reason;
  }
}

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export function parsePublicUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new SsrfRejectedError("malformed", "URL didn't parse.");
  }
  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new SsrfRejectedError(
      "invalid_scheme",
      `Only http(s) URLs are supported (got ${parsed.protocol}).`
    );
  }
  // Hosts that contain user-info like `user:pass@host` are stripped by the
  // URL parser, but a literal IP in the hostname needs checking up front
  // because `dns.lookup` happily returns it back unchanged.
  if (!parsed.hostname) {
    throw new SsrfRejectedError("malformed", "URL is missing a hostname.");
  }
  return parsed;
}

/**
 * Resolve `hostname` to one or more IP addresses and reject if any of
 * them sits in a non-routable range. We check ALL resolved IPs (not
 * just the first one fetch would happen to pick) because some
 * resolvers shuffle results — relying on the first one would be
 * order-dependent.
 *
 * Returns the list of resolved IPs on success, mostly for logging /
 * tests. The fetcher in `fetchHtmlSafely` doesn't pin the IP for the
 * actual request (Node fetch lacks the hook); see file header for the
 * DNS-rebinding caveat.
 */
export async function assertHostnamePublic(hostname: string): Promise<string[]> {
  // Literal IPs are returned unchanged by `dns.lookup`. The check
  // below catches both literal-IP-in-URL and DNS-resolved-IP cases
  // with the same logic.
  let resolved: Array<{ address: string; family: number }>;
  try {
    resolved = await lookup(hostname, { all: true });
  } catch {
    throw new SsrfRejectedError(
      "malformed",
      `Couldn't resolve ${hostname}.`
    );
  }
  if (resolved.length === 0) {
    throw new SsrfRejectedError(
      "malformed",
      `No DNS records for ${hostname}.`
    );
  }
  for (const { address } of resolved) {
    if (isPrivateAddress(address)) {
      throw new SsrfRejectedError(
        "private_network",
        `${hostname} resolves to a non-public address (${address}).`
      );
    }
  }
  return resolved.map((r) => r.address);
}

/**
 * IPv4 + IPv6 range check. Covers the standard non-routable blocks:
 *   - 0.0.0.0/8 — "this network" (boots / DHCP)
 *   - 10.0.0.0/8 — RFC 1918 private
 *   - 100.64.0.0/10 — carrier-grade NAT
 *   - 127.0.0.0/8 — loopback
 *   - 169.254.0.0/16 — link-local (includes 169.254.169.254 — cloud metadata!)
 *   - 172.16.0.0/12 — RFC 1918 private
 *   - 192.0.0.0/24 — IETF protocol assignments
 *   - 192.168.0.0/16 — RFC 1918 private
 *   - 198.18.0.0/15 — network benchmarking
 *   - 224.0.0.0/4 — multicast
 *   - 240.0.0.0/4 — reserved
 *   - ::1/128 — IPv6 loopback
 *   - ::/128 — unspecified
 *   - fc00::/7 — IPv6 unique-local
 *   - fe80::/10 — IPv6 link-local
 *   - ::ffff:0:0/96 — IPv4-mapped IPv6 (have to recurse on the v4 part)
 *
 * Exported for tests.
 */
export function isPrivateAddress(address: string): boolean {
  if (address.includes(":")) {
    return isPrivateIpv6(address);
  }
  return isPrivateIpv4(address);
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split(".");
  if (parts.length !== 4) return true; // malformed → reject conservatively
  const octets = parts.map((p) => Number(p));
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = octets;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8
  if (a === 169 && b === 254) return true; // 169.254.0.0/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 (IETF) + 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10
  if (a >= 224) return true; // 224.0.0.0/4 + 240.0.0.0/4 + 255.255.255.255
  return false;
}

function isPrivateIpv6(address: string): boolean {
  const lower = address.toLowerCase();
  if (lower === "::" || lower === "::1") return true;
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d)
  // forms can smuggle a private v4 address. Pull the v4 tail and
  // recurse so 192.168.x.y can't sneak through as ::ffff:192.168.x.y.
  if (lower.includes(".")) {
    const lastColon = lower.lastIndexOf(":");
    const ipv4Part = lower.slice(lastColon + 1);
    if (isPrivateIpv4(ipv4Part)) return true;
  }
  // Unique-local: fc00::/7  →  first byte 0xfc or 0xfd  →  starts with "fc" or "fd"
  if (/^fc|^fd/.test(lower)) return true;
  // Link-local: fe80::/10  →  first 10 bits 1111 1110 10  →  fe80–febf
  if (/^fe[89ab]/.test(lower)) return true;
  return false;
}
