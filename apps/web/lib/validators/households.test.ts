import { describe, expect, it } from "vitest";
import {
  acceptInvitationSchema,
  createInvitationSchema,
  revokeInvitationSchema
} from "./households";

describe("createInvitationSchema", () => {
  it("trims and lowercases the email", () => {
    const parsed = createInvitationSchema.parse({ email: "  ALEX@example.COM  " });
    expect(parsed.email).toBe("alex@example.com");
  });

  it("accepts a typical email", () => {
    const parsed = createInvitationSchema.parse({ email: "guest@eeatly.app" });
    expect(parsed.email).toBe("guest@eeatly.app");
  });

  it("rejects malformed addresses", () => {
    expect(() => createInvitationSchema.parse({ email: "not-an-email" })).toThrow(
      /valid email/
    );
    expect(() => createInvitationSchema.parse({ email: "" })).toThrow();
    expect(() => createInvitationSchema.parse({ email: "a@b" })).toThrow();
  });

  it("rejects emails longer than 254 chars", () => {
    const local = "a".repeat(245);
    const tooLong = `${local}@example.com`; // 245 + 12 = 257
    expect(() => createInvitationSchema.parse({ email: tooLong })).toThrow(/too long/);
  });

  it("requires an email key", () => {
    expect(() => createInvitationSchema.parse({})).toThrow();
  });
});

describe("acceptInvitationSchema", () => {
  it("accepts a base64url-shaped token", () => {
    const token = "a".repeat(43); // randomBytes(32).toString("base64url") = 43 chars
    const parsed = acceptInvitationSchema.parse({ token });
    expect(parsed.token).toBe(token);
  });

  it("rejects tokens shorter than 32 chars", () => {
    expect(() => acceptInvitationSchema.parse({ token: "short" })).toThrow(/malformed/);
    expect(() => acceptInvitationSchema.parse({ token: "a".repeat(31) })).toThrow(
      /malformed/
    );
  });

  it("rejects tokens longer than 128 chars", () => {
    expect(() => acceptInvitationSchema.parse({ token: "a".repeat(129) })).toThrow(
      /malformed/
    );
  });

  it("rejects missing token", () => {
    expect(() => acceptInvitationSchema.parse({})).toThrow();
  });
});

describe("revokeInvitationSchema", () => {
  it("accepts a uuid", () => {
    const parsed = revokeInvitationSchema.parse({
      invitationId: "0e2a8d4f-2a2f-4b6a-9c70-7d3a5b1a2c45"
    });
    expect(parsed.invitationId).toBe("0e2a8d4f-2a2f-4b6a-9c70-7d3a5b1a2c45");
  });

  it("rejects non-uuid invitation ids", () => {
    expect(() => revokeInvitationSchema.parse({ invitationId: "not-a-uuid" })).toThrow(
      /Invalid invitation id/
    );
    expect(() => revokeInvitationSchema.parse({ invitationId: "" })).toThrow();
  });
});
