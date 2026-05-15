import { describe, expect, it } from "vitest";
import {
  audioInputSchema,
  isSupportedAudioMediaType,
  MAX_AUDIO_UPLOAD_BYTES,
  mealSuggestionSchema,
  urlPreviewInputSchema
} from "@eeatly/api/validators/ai";

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

describe("urlPreviewInputSchema (Round 16)", () => {
  it("trims whitespace and accepts a URL", () => {
    const parsed = urlPreviewInputSchema.parse({
      url: "  https://example.com/recipe  "
    });
    expect(parsed.url).toBe("https://example.com/recipe");
  });

  it("rejects empty strings via the min(1) guard", () => {
    expect(() => urlPreviewInputSchema.parse({ url: "" })).toThrow();
  });

  it("rejects URLs over 2048 chars", () => {
    const long = "https://example.com/" + "x".repeat(2050);
    expect(() => urlPreviewInputSchema.parse({ url: long })).toThrow(/too long/);
  });
});
