import { describe, expect, it } from "vitest";
import {
  isPrivateAddress,
  parsePublicUrl,
  SsrfRejectedError
} from "./ssrf";

describe("parsePublicUrl", () => {
  it("accepts https URLs", () => {
    const parsed = parsePublicUrl("https://cooking.nytimes.com/recipes/123");
    expect(parsed.protocol).toBe("https:");
    expect(parsed.hostname).toBe("cooking.nytimes.com");
  });

  it("accepts http URLs (legacy blog posts still exist)", () => {
    const parsed = parsePublicUrl("http://example.com/recipe");
    expect(parsed.hostname).toBe("example.com");
  });

  it("trims whitespace before parsing", () => {
    expect(parsePublicUrl("  https://example.com  ").hostname).toBe("example.com");
  });

  it("rejects file:// URLs", () => {
    expect(() => parsePublicUrl("file:///etc/passwd")).toThrow(SsrfRejectedError);
  });

  it("rejects gopher:// URLs", () => {
    expect(() => parsePublicUrl("gopher://example.com/")).toThrow(SsrfRejectedError);
  });

  it("rejects javascript: URIs", () => {
    expect(() => parsePublicUrl("javascript:alert(1)")).toThrow(SsrfRejectedError);
  });

  it("rejects malformed strings", () => {
    expect(() => parsePublicUrl("not a url")).toThrow(SsrfRejectedError);
    expect(() => parsePublicUrl("")).toThrow(SsrfRejectedError);
  });
});

describe("isPrivateAddress (IPv4)", () => {
  // Each block we explicitly defend against from the spec.
  const PRIVATE_IPV4 = [
    "0.0.0.0",
    "0.1.2.3",
    "10.0.0.1",
    "10.255.255.254",
    "100.64.0.1",
    "100.127.255.254",
    "127.0.0.1",
    "127.255.255.254",
    "169.254.169.254", // AWS instance metadata — the canonical SSRF target
    "172.16.0.1",
    "172.31.255.254",
    "192.0.0.1",
    "192.168.0.1",
    "192.168.255.254",
    "198.18.0.1",
    "198.19.255.254",
    "224.0.0.1",
    "240.0.0.1",
    "255.255.255.255"
  ];

  for (const address of PRIVATE_IPV4) {
    it(`rejects ${address}`, () => {
      expect(isPrivateAddress(address)).toBe(true);
    });
  }

  const PUBLIC_IPV4 = [
    "8.8.8.8", // Google DNS
    "1.1.1.1", // Cloudflare DNS
    "151.101.1.1", // Fastly
    "172.217.0.1" // Google
  ];

  for (const address of PUBLIC_IPV4) {
    it(`allows ${address}`, () => {
      expect(isPrivateAddress(address)).toBe(false);
    });
  }

  it("rejects malformed IPv4 conservatively (treated as private)", () => {
    expect(isPrivateAddress("not.an.ip.addr")).toBe(true);
    expect(isPrivateAddress("1.2.3")).toBe(true);
    expect(isPrivateAddress("999.0.0.0")).toBe(true);
  });
});

describe("isPrivateAddress (IPv6)", () => {
  const PRIVATE_IPV6 = [
    "::1", // loopback
    "::", // unspecified
    "fc00::1", // unique-local
    "fd12:3456:789a::1", // unique-local
    "fe80::1", // link-local
    "fe80:abcd::1", // link-local
    "::ffff:127.0.0.1", // IPv4-mapped loopback
    "::ffff:169.254.169.254" // IPv4-mapped metadata
  ];

  for (const address of PRIVATE_IPV6) {
    it(`rejects ${address}`, () => {
      expect(isPrivateAddress(address)).toBe(true);
    });
  }

  const PUBLIC_IPV6 = [
    "2001:4860:4860::8888", // Google DNS
    "2606:4700:4700::1111" // Cloudflare DNS
  ];

  for (const address of PUBLIC_IPV6) {
    it(`allows ${address}`, () => {
      expect(isPrivateAddress(address)).toBe(false);
    });
  }
});
