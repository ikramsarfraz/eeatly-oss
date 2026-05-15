import { describe, expect, it } from "vitest";
import {
  audioInputSchema,
  classifyYoutubeUrl,
  isSupportedAudioMediaType,
  MAX_AUDIO_UPLOAD_BYTES,
  mealSuggestionSchema,
  youtubeUrlSchema
} from "@eeatly/api/validators/ai";

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

describe("audioInputSchema (Round 8)", () => {
  it("accepts each browser/WhatsApp media type we support", () => {
    const types = [
      "audio/mpeg",
      "audio/mp3",
      "audio/mp4",
      "audio/m4a",
      "audio/x-m4a",
      "audio/ogg",
      "audio/opus",
      "audio/wav",
      "audio/x-wav",
      "audio/webm",
      "audio/flac"
    ];
    for (const mediaType of types) {
      const parsed = audioInputSchema.parse({ mediaType, size: 1024 });
      expect(parsed.mediaType).toBe(mediaType);
    }
  });

  it("rejects unsupported media types with a friendly message", () => {
    expect(() => audioInputSchema.parse({ mediaType: "audio/aiff", size: 1024 })).toThrow(
      /Unsupported audio format/
    );
  });

  it("rejects empty audio (size 0)", () => {
    expect(() => audioInputSchema.parse({ mediaType: "audio/webm", size: 0 })).toThrow();
  });

  it("rejects audio above the 25 MB cap", () => {
    expect(() =>
      audioInputSchema.parse({ mediaType: "audio/webm", size: MAX_AUDIO_UPLOAD_BYTES + 1 })
    ).toThrow(/25 MB/);
  });

  it("isSupportedAudioMediaType narrows the type", () => {
    expect(isSupportedAudioMediaType("audio/webm")).toBe(true);
    expect(isSupportedAudioMediaType("text/plain")).toBe(false);
  });
});

describe("mealSuggestionSchema (Round 10)", () => {
  const minimal = {
    name: "Chicken karahi",
    effortGuess: "medium" as const,
    notes: "",
    recipeText: "ingredients\nsteps",
    confidence: "high" as const
  };

  it("accepts a response WITHOUT ingredients (legacy / pre-Round-10 fixtures)", () => {
    const parsed = mealSuggestionSchema.parse(minimal);
    expect(parsed.ingredients).toBeUndefined();
    expect(parsed.name).toBe("Chicken karahi");
  });

  it("accepts a response WITH an ingredients array", () => {
    const parsed = mealSuggestionSchema.parse({
      ...minimal,
      ingredients: ["1 cup basmati rice", "2 tbsp ghee", "1 tsp cardamom pods"]
    });
    expect(parsed.ingredients).toEqual([
      "1 cup basmati rice",
      "2 tbsp ghee",
      "1 tsp cardamom pods"
    ]);
  });

  it("accepts an empty ingredients array (the AI saw no ingredients)", () => {
    const parsed = mealSuggestionSchema.parse({ ...minimal, ingredients: [] });
    expect(parsed.ingredients).toEqual([]);
  });

  it("rejects non-array ingredients values", () => {
    expect(() =>
      mealSuggestionSchema.parse({ ...minimal, ingredients: "rice, ghee" })
    ).toThrow();
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
