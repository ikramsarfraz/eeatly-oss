import { describe, expect, it } from "vitest";
import { classifyYoutubeUrl, youtubeUrlSchema } from "./ai";

describe("classifyYoutubeUrl", () => {
  it("accepts /watch?v=<id> variants", () => {
    const result = classifyYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(result.kind).toBe("watch");
    if (result.kind === "watch") {
      expect(result.videoId).toBe("dQw4w9WgXcQ");
      expect(result.normalizedUrl).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    }
  });

  it("accepts youtu.be short links", () => {
    const result = classifyYoutubeUrl("https://youtu.be/dQw4w9WgXcQ");
    expect(result.kind).toBe("watch");
    if (result.kind === "watch") expect(result.videoId).toBe("dQw4w9WgXcQ");
  });

  it("accepts mobile m.youtube.com URLs", () => {
    const result = classifyYoutubeUrl(
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ"
    );
    expect(result.kind).toBe("watch");
  });

  it("accepts /watch URLs with extra query params (like &list=)", () => {
    // /watch?v=X&list=Y is still a valid watch URL — the video plays in
    // a playlist context but the resource is the video. Only the bare
    // /playlist path is rejected.
    const result = classifyYoutubeUrl(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLxxx"
    );
    expect(result.kind).toBe("watch");
  });

  it("accepts /embed/<id> (paste-from-iframe edge case)", () => {
    const result = classifyYoutubeUrl(
      "https://www.youtube.com/embed/dQw4w9WgXcQ"
    );
    expect(result.kind).toBe("watch");
  });

  it("classifies /shorts/<id> as shorts (rejected upstream)", () => {
    const result = classifyYoutubeUrl(
      "https://www.youtube.com/shorts/dQw4w9WgXcQ"
    );
    expect(result.kind).toBe("shorts");
  });

  it("classifies /playlist?list=<id> as playlist (rejected upstream)", () => {
    const result = classifyYoutubeUrl(
      "https://www.youtube.com/playlist?list=PLxxx"
    );
    expect(result.kind).toBe("playlist");
  });

  it("rejects non-YouTube URLs", () => {
    expect(classifyYoutubeUrl("https://vimeo.com/12345").kind).toBe("invalid");
    expect(classifyYoutubeUrl("https://example.com/watch?v=x").kind).toBe(
      "invalid"
    );
  });

  it("rejects malformed URLs", () => {
    expect(classifyYoutubeUrl("not a url").kind).toBe("invalid");
    expect(classifyYoutubeUrl("").kind).toBe("invalid");
    expect(classifyYoutubeUrl("https://www.youtube.com").kind).toBe("invalid");
  });

  it("rejects /watch URLs without a video id", () => {
    expect(classifyYoutubeUrl("https://www.youtube.com/watch").kind).toBe(
      "invalid"
    );
    expect(classifyYoutubeUrl("https://www.youtube.com/watch?v=").kind).toBe(
      "invalid"
    );
  });
});

describe("youtubeUrlSchema", () => {
  it("trims whitespace and accepts a valid URL", () => {
    const parsed = youtubeUrlSchema.parse({
      url: "  https://youtu.be/dQw4w9WgXcQ  "
    });
    expect(parsed.url).toBe("https://youtu.be/dQw4w9WgXcQ");
  });

  it("rejects strings that don't classify as any known YouTube shape", () => {
    expect(() =>
      youtubeUrlSchema.parse({ url: "https://vimeo.com/1" })
    ).toThrow(/doesn't look like a YouTube link/);
  });

  it("rejects empty strings via the min(1) guard", () => {
    expect(() => youtubeUrlSchema.parse({ url: "" })).toThrow();
  });
});
