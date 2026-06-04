import { describe, expect, it } from "vitest";
import { detectPlatform } from "@eeatly/shared";

describe("detectPlatform", () => {
  describe("YouTube", () => {
    it("recognizes /watch?v=<id>", () => {
      const r = detectPlatform("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(r).toEqual({
        platform: "youtube",
        videoId: "dQw4w9WgXcQ",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      });
    });

    it("recognizes youtu.be short links", () => {
      const r = detectPlatform("https://youtu.be/dQw4w9WgXcQ");
      expect(r?.platform).toBe("youtube");
      if (r?.platform === "youtube") expect(r.videoId).toBe("dQw4w9WgXcQ");
    });

    it("recognizes mobile m.youtube.com", () => {
      const r = detectPlatform("https://m.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(r?.platform).toBe("youtube");
    });

    it("recognizes /embed/<id>", () => {
      const r = detectPlatform("https://www.youtube.com/embed/dQw4w9WgXcQ");
      expect(r?.platform).toBe("youtube");
      if (r?.platform === "youtube") expect(r.videoId).toBe("dQw4w9WgXcQ");
    });

    it("recognizes /shorts/<id> (we embed shorts too — they have legit content)", () => {
      const r = detectPlatform("https://www.youtube.com/shorts/dQw4w9WgXcQ");
      expect(r?.platform).toBe("youtube");
    });

    it("falls back to web for non-watch YouTube paths", () => {
      // Channel page — no video id, treat as a generic web URL with OG preview.
      const r = detectPlatform("https://www.youtube.com/@cookwithamna");
      expect(r?.platform).toBe("web");
    });
  });

  describe("TikTok", () => {
    it("recognizes long-form /video/<id> URLs", () => {
      const r = detectPlatform(
        "https://www.tiktok.com/@user/video/7123456789012345678"
      );
      expect(r?.platform).toBe("tiktok");
      if (r?.platform === "tiktok") {
        expect(r.videoId).toBe("7123456789012345678");
      }
    });

    it("recognizes short links (vm.tiktok.com) but leaves videoId null", () => {
      const r = detectPlatform("https://vm.tiktok.com/ZMabc123/");
      expect(r?.platform).toBe("tiktok");
      if (r?.platform === "tiktok") expect(r.videoId).toBe(null);
    });
  });

  describe("Pinterest", () => {
    it("recognizes pinterest.com", () => {
      const r = detectPlatform("https://www.pinterest.com/pin/12345/");
      expect(r?.platform).toBe("pinterest");
    });

    it("recognizes pin.it short links", () => {
      const r = detectPlatform("https://pin.it/abc123");
      expect(r?.platform).toBe("pinterest");
    });
  });

  describe("Instagram", () => {
    it("recognizes instagram.com (no real embed in v1 — surfaces as OG preview)", () => {
      const r = detectPlatform("https://www.instagram.com/reel/abc123/");
      expect(r?.platform).toBe("instagram");
    });
  });

  describe("Generic web", () => {
    it("recognizes blog URLs", () => {
      const r = detectPlatform("https://cooking.nytimes.com/recipes/1024-rice");
      expect(r?.platform).toBe("web");
    });
  });

  describe("Invalid input", () => {
    it("returns null for non-URLs", () => {
      expect(detectPlatform("not a url")).toBe(null);
      expect(detectPlatform("")).toBe(null);
    });

    it("returns null for non-http(s) schemes", () => {
      expect(detectPlatform("file:///etc/passwd")).toBe(null);
      expect(detectPlatform("javascript:alert(1)")).toBe(null);
    });
  });
});
