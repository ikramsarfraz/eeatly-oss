import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  crossSubdomainCookiesEnabled,
  getAdminHostname,
  getRootDomain,
  hostnameOf,
  isAdminHost
} from "./admin-host";

const ORIGINAL = process.env.ROOT_DOMAIN;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ROOT_DOMAIN;
  else process.env.ROOT_DOMAIN = ORIGINAL;
});

describe("admin-host", () => {
  describe("when ROOT_DOMAIN is unset", () => {
    beforeEach(() => {
      delete process.env.ROOT_DOMAIN;
    });

    it("reports no root domain / admin host", () => {
      expect(getRootDomain()).toBeNull();
      expect(getAdminHostname()).toBeNull();
      expect(isAdminHost("admin.localtest.me:3003")).toBe(false);
      expect(crossSubdomainCookiesEnabled()).toBe(false);
    });
  });

  describe("with a real root domain (localtest.me)", () => {
    beforeEach(() => {
      process.env.ROOT_DOMAIN = "localtest.me";
    });

    it("derives the admin hostname", () => {
      expect(getRootDomain()).toBe("localtest.me");
      expect(getAdminHostname()).toBe("admin.localtest.me");
    });

    it("matches the admin host regardless of port", () => {
      expect(isAdminHost("admin.localtest.me")).toBe(true);
      expect(isAdminHost("admin.localtest.me:3003")).toBe(true);
      expect(isAdminHost("ADMIN.LOCALTEST.ME:3003")).toBe(true);
    });

    it("does not match the root host or other subdomains", () => {
      expect(isAdminHost("localtest.me:3003")).toBe(false);
      expect(isAdminHost("www.localtest.me:3003")).toBe(false);
      expect(isAdminHost("admin.evil.com:3003")).toBe(false);
      expect(isAdminHost(null)).toBe(false);
      expect(isAdminHost(undefined)).toBe(false);
    });

    it("enables cross-subdomain cookies", () => {
      expect(crossSubdomainCookiesEnabled()).toBe(true);
    });

    it("strips protocol and trailing slash from ROOT_DOMAIN", () => {
      process.env.ROOT_DOMAIN = "https://eeatly.com/";
      expect(getRootDomain()).toBe("eeatly.com");
      expect(getAdminHostname()).toBe("admin.eeatly.com");
      expect(isAdminHost("admin.eeatly.com")).toBe(true);
    });
  });

  describe("localhost root domain", () => {
    it("keeps cross-subdomain cookies OFF (browsers reject shared Domain)", () => {
      process.env.ROOT_DOMAIN = "localhost";
      expect(crossSubdomainCookiesEnabled()).toBe(false);
    });
  });

  describe("hostnameOf", () => {
    it("strips the port", () => {
      expect(hostnameOf("admin.localtest.me:3003")).toBe("admin.localtest.me");
      expect(hostnameOf("eeatly.com")).toBe("eeatly.com");
      expect(hostnameOf("ADMIN.localtest.me")).toBe("admin.localtest.me");
    });
  });
});
