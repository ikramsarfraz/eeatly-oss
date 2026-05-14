import { beforeEach, describe, expect, it, vi } from "vitest";

// Short-circuit the env-validation chain (lib/auth → lib/db/client). The
// action only needs `requireCurrentUser` at runtime, and the service
// surfaces are mocked below.
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => null } }
}));

vi.mock("@/lib/auth/session", () => ({
  requireCurrentUser: async () => ({
    id: "u-1",
    name: "Alex",
    email: "alex@example.com",
    image: null,
    role: "root_app_user" as const
  }),
  requireCurrentUserWithHousehold: async () => ({
    user: {
      id: "u-1",
      name: "Alex",
      email: "alex@example.com",
      image: null,
      role: "root_app_user" as const
    },
    household: { id: "h-1", name: "Alex's Kitchen" }
  })
}));

const rateLimitMock = vi.hoisted(() => ({
  checkAiCallLimit: vi.fn<(userId: string) => Promise<void>>()
}));
vi.mock("@/lib/security/rate-limit", () => rateLimitMock);

const serviceMock = vi.hoisted(() => ({
  suggestMealFromImage: vi.fn(),
  suggestMealFromText: vi.fn(),
  suggestMealFromYouTubeUrl: vi.fn(),
  suggestMealFromAudio: vi.fn(),
  generateShareableRecipe: vi.fn()
}));
vi.mock("@/services/ai", () => serviceMock);

// Round 6: actions now call requireFeatureAccess for the AI gates.
// The default-permissive stub keeps the existing test assertions
// stable; one new test below pins the UPGRADE_REQUIRED branch.
const gateMock = vi.hoisted(() => ({
  requireFeatureAccess: vi.fn<(userId: string, feature: string) => Promise<void>>(),
  can: vi.fn<(userId: string, feature: string) => Promise<boolean>>()
}));
vi.mock("@/lib/gates/resolver", () => gateMock);

import {
  suggestFromAudioAction,
  suggestFromImageAction,
  suggestFromTextAction,
  suggestFromYouTubeAction,
  type SuggestResult
} from "./ai";

beforeEach(() => {
  rateLimitMock.checkAiCallLimit.mockReset();
  rateLimitMock.checkAiCallLimit.mockResolvedValue();
  serviceMock.suggestMealFromImage.mockReset();
  serviceMock.suggestMealFromText.mockReset();
  serviceMock.suggestMealFromYouTubeUrl.mockReset();
  serviceMock.suggestMealFromAudio.mockReset();
  gateMock.requireFeatureAccess.mockReset();
  gateMock.requireFeatureAccess.mockResolvedValue();
  gateMock.can.mockReset();
  gateMock.can.mockResolvedValue(true);
});

function makeImageFormData(opts: { size?: number; type?: string } = {}): FormData {
  const fd = new FormData();
  const size = opts.size ?? 64;
  const type = opts.type ?? "image/jpeg";
  fd.append("image", new File([new Uint8Array(size)], "x.jpg", { type }));
  return fd;
}

describe("suggestFromImageAction discriminated-union surface", () => {
  it("returns INVALID_INPUT when no file is attached", async () => {
    const result = await suggestFromImageAction(new FormData());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_INPUT");
    expect(serviceMock.suggestMealFromImage).not.toHaveBeenCalled();
  });

  it("returns INVALID_INPUT when the file exceeds the 10 MB cap", async () => {
    const result = await suggestFromImageAction(
      makeImageFormData({ size: 11 * 1024 * 1024 })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("INVALID_INPUT");
      expect(result.message).toMatch(/under 10 MB/);
    }
    expect(serviceMock.suggestMealFromImage).not.toHaveBeenCalled();
  });

  it("returns RATE_LIMITED when the AI call budget is exhausted", async () => {
    rateLimitMock.checkAiCallLimit.mockRejectedValueOnce(new Error("rate"));
    const result = await suggestFromImageAction(makeImageFormData());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("RATE_LIMITED");
    // Service must not be called when the limit fires — that's the
    // entire point of the throttle.
    expect(serviceMock.suggestMealFromImage).not.toHaveBeenCalled();
  });

  it("returns INVALID_INPUT for an unsupported media type (service-throw → typed code)", async () => {
    // The service throws an error containing "unsupported image type" for
    // non-image MIME types. The action maps that specific message to
    // INVALID_INPUT (user mistake, not provider failure).
    serviceMock.suggestMealFromImage.mockRejectedValueOnce(
      new Error("Unsupported image type: image/tiff")
    );
    const result = await suggestFromImageAction(
      makeImageFormData({ type: "image/tiff" })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_INPUT");
  });

  it("returns AI_PROVIDER_ERROR when the service throws for non-input reasons", async () => {
    serviceMock.suggestMealFromImage.mockRejectedValueOnce(
      new Error("both providers down")
    );
    const result = await suggestFromImageAction(makeImageFormData());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AI_PROVIDER_ERROR");
      // We deliberately don't surface the raw provider message to users —
      // verify the action wrote a generic one.
      expect(result.message).not.toContain("both providers down");
    }
  });

  it("returns ok with the suggestion on success", async () => {
    const suggestion = {
      name: "Soy ginger noodles",
      effortGuess: "easy" as const,
      notes: "",
      recipeText: "",
      confidence: "high" as const
    };
    serviceMock.suggestMealFromImage.mockResolvedValueOnce(suggestion);

    const result: SuggestResult = await suggestFromImageAction(makeImageFormData());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual(suggestion);
  });
});

describe("suggestFromTextAction discriminated-union surface", () => {
  it("returns INVALID_INPUT for empty/whitespace text", async () => {
    const result = await suggestFromTextAction("   ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_INPUT");
    expect(serviceMock.suggestMealFromText).not.toHaveBeenCalled();
  });

  it("returns RATE_LIMITED when the budget is exhausted", async () => {
    rateLimitMock.checkAiCallLimit.mockRejectedValueOnce(new Error("rate"));
    const result = await suggestFromTextAction("legitimate text");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("RATE_LIMITED");
  });

  it("returns AI_PROVIDER_ERROR when the service throws", async () => {
    serviceMock.suggestMealFromText.mockRejectedValueOnce(new Error("provider down"));
    const result = await suggestFromTextAction("legitimate text");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AI_PROVIDER_ERROR");
  });

  it("returns ok with the suggestion on success", async () => {
    serviceMock.suggestMealFromText.mockResolvedValueOnce({
      name: "Lasagna",
      effortGuess: "medium",
      notes: "",
      recipeText: "",
      confidence: "medium"
    });
    const result = await suggestFromTextAction("a paragraph about lasagna");
    expect(result.ok).toBe(true);
  });
});

describe("Round 6 — UPGRADE_REQUIRED gate translation", () => {
  it("suggestFromImageAction returns UPGRADE_REQUIRED with the feature key when the gate denies", async () => {
    // Use the actual error class so the action's `instanceof` check
    // fires. Imported here rather than at the top because the test
    // file's import chain otherwise drags lib/gates/registry; the
    // gateMock above intercepts the resolver module, but the error
    // class lives in lib/errors/gates so the regular import works.
    const { FeatureGateDeniedError } = await import("@/lib/errors/gates");
    gateMock.requireFeatureAccess.mockRejectedValueOnce(
      new FeatureGateDeniedError("ai_suggest_image")
    );

    const result = await suggestFromImageAction(makeImageFormData());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UPGRADE_REQUIRED");
      expect(result.feature).toBe("ai_suggest_image");
    }
    // Rate-limit check must NOT fire when the gate denies — gate runs
    // first so we don't burn a slot for a user who can't use the
    // feature anyway.
    expect(rateLimitMock.checkAiCallLimit).not.toHaveBeenCalled();
    expect(serviceMock.suggestMealFromImage).not.toHaveBeenCalled();
  });

  it("suggestFromTextAction returns UPGRADE_REQUIRED with the feature key when the gate denies", async () => {
    const { FeatureGateDeniedError } = await import("@/lib/errors/gates");
    gateMock.requireFeatureAccess.mockRejectedValueOnce(
      new FeatureGateDeniedError("ai_suggest_text")
    );

    const result = await suggestFromTextAction("legitimate text");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UPGRADE_REQUIRED");
      expect(result.feature).toBe("ai_suggest_text");
    }
    expect(serviceMock.suggestMealFromText).not.toHaveBeenCalled();
  });
});

describe("suggestFromYouTubeAction — discriminated-union surface", () => {
  it("rejects malformed URLs at the Zod layer with INVALID_INPUT", async () => {
    const result = await suggestFromYouTubeAction({ url: "https://vimeo.com/1" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_INPUT");
    expect(serviceMock.suggestMealFromYouTubeUrl).not.toHaveBeenCalled();
  });

  it("returns RATE_LIMITED when the daily AI budget is exhausted", async () => {
    rateLimitMock.checkAiCallLimit.mockRejectedValueOnce(new Error("rate"));
    const result = await suggestFromYouTubeAction({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("RATE_LIMITED");
    expect(serviceMock.suggestMealFromYouTubeUrl).not.toHaveBeenCalled();
  });

  it("maps each typed YouTube error to its discriminated-union code", async () => {
    const cases: Array<{
      errorName:
        | "YoutubeShortsUnsupportedError"
        | "YoutubePlaylistUnsupportedError"
        | "YoutubeNoTranscriptError"
        | "YoutubeUnavailableError"
        | "YoutubeAgeRestrictedError"
        | "YoutubeFetchFailedError";
      expectedCode:
        | "YOUTUBE_SHORTS_UNSUPPORTED"
        | "YOUTUBE_PLAYLIST_UNSUPPORTED"
        | "YOUTUBE_NO_TRANSCRIPT"
        | "YOUTUBE_UNAVAILABLE"
        | "YOUTUBE_AGE_RESTRICTED"
        | "YOUTUBE_FETCH_FAILED";
    }> = [
      { errorName: "YoutubeShortsUnsupportedError", expectedCode: "YOUTUBE_SHORTS_UNSUPPORTED" },
      { errorName: "YoutubePlaylistUnsupportedError", expectedCode: "YOUTUBE_PLAYLIST_UNSUPPORTED" },
      { errorName: "YoutubeNoTranscriptError", expectedCode: "YOUTUBE_NO_TRANSCRIPT" },
      { errorName: "YoutubeUnavailableError", expectedCode: "YOUTUBE_UNAVAILABLE" },
      { errorName: "YoutubeAgeRestrictedError", expectedCode: "YOUTUBE_AGE_RESTRICTED" },
      { errorName: "YoutubeFetchFailedError", expectedCode: "YOUTUBE_FETCH_FAILED" }
    ];

    const errors = await import("@/lib/errors/youtube");
    for (const { errorName, expectedCode } of cases) {
      const ErrorClass = errors[errorName] as new () => Error;
      serviceMock.suggestMealFromYouTubeUrl.mockRejectedValueOnce(new ErrorClass());
      const result = await suggestFromYouTubeAction({
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe(expectedCode);
    }
  });

  it("returns UPGRADE_REQUIRED when the gate denies", async () => {
    const { FeatureGateDeniedError } = await import("@/lib/errors/gates");
    serviceMock.suggestMealFromYouTubeUrl.mockRejectedValueOnce(
      new FeatureGateDeniedError("ai_suggest_youtube")
    );
    const result = await suggestFromYouTubeAction({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UPGRADE_REQUIRED");
      expect(result.feature).toBe("ai_suggest_youtube");
    }
  });

  it("returns ok with the suggestion on success", async () => {
    serviceMock.suggestMealFromYouTubeUrl.mockResolvedValueOnce({
      name: "Chicken karahi",
      effortGuess: "medium",
      notes: "",
      recipeText: "ingredients\nsteps",
      confidence: "high"
    });
    const result = await suggestFromYouTubeAction({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.name).toBe("Chicken karahi");
  });
});

describe("suggestFromAudioAction — discriminated-union surface", () => {
  function makeAudioFormData(
    opts: { size?: number; type?: string; name?: string } = {}
  ): FormData {
    const fd = new FormData();
    const size = opts.size ?? 2048;
    const type = opts.type ?? "audio/webm";
    const name = opts.name ?? "voice-note.webm";
    fd.append("audio", new File([new Uint8Array(size)], name, { type }));
    return fd;
  }

  it("returns INVALID_INPUT when no file is attached", async () => {
    const result = await suggestFromAudioAction(new FormData());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INVALID_INPUT");
    expect(serviceMock.suggestMealFromAudio).not.toHaveBeenCalled();
  });

  it("returns AUDIO_TOO_LARGE for files above 25 MB", async () => {
    const result = await suggestFromAudioAction(
      makeAudioFormData({ size: 26 * 1024 * 1024 })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUDIO_TOO_LARGE");
    expect(serviceMock.suggestMealFromAudio).not.toHaveBeenCalled();
  });

  it("returns AUDIO_INVALID_FORMAT for unsupported media types", async () => {
    const result = await suggestFromAudioAction(
      makeAudioFormData({ type: "audio/aiff" })
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("AUDIO_INVALID_FORMAT");
    expect(serviceMock.suggestMealFromAudio).not.toHaveBeenCalled();
  });

  it("returns RATE_LIMITED when the daily AI budget is exhausted", async () => {
    rateLimitMock.checkAiCallLimit.mockRejectedValueOnce(new Error("rate"));
    const result = await suggestFromAudioAction(makeAudioFormData());
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("RATE_LIMITED");
    expect(serviceMock.suggestMealFromAudio).not.toHaveBeenCalled();
  });

  it("maps each typed audio error to its discriminated-union code", async () => {
    const audioErrors = await import("@/lib/errors/audio");
    const cases: Array<{
      ErrorClass: new () => Error;
      expectedCode:
        | "AUDIO_TOO_LARGE"
        | "AUDIO_INVALID_FORMAT"
        | "AUDIO_TRANSCRIPTION_FAILED"
        | "AUDIO_TOO_SHORT_OR_EMPTY";
    }> = [
      { ErrorClass: audioErrors.AudioTooLargeError, expectedCode: "AUDIO_TOO_LARGE" },
      {
        ErrorClass: audioErrors.AudioInvalidFormatError as unknown as new () => Error,
        expectedCode: "AUDIO_INVALID_FORMAT"
      },
      {
        ErrorClass: audioErrors.AudioTranscriptionFailedError,
        expectedCode: "AUDIO_TRANSCRIPTION_FAILED"
      },
      {
        ErrorClass: audioErrors.AudioTooShortOrEmptyError,
        expectedCode: "AUDIO_TOO_SHORT_OR_EMPTY"
      }
    ];
    for (const { ErrorClass, expectedCode } of cases) {
      serviceMock.suggestMealFromAudio.mockRejectedValueOnce(new ErrorClass());
      const result = await suggestFromAudioAction(makeAudioFormData());
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe(expectedCode);
    }
  });

  it("returns UPGRADE_REQUIRED when the gate denies", async () => {
    const { FeatureGateDeniedError } = await import("@/lib/errors/gates");
    serviceMock.suggestMealFromAudio.mockRejectedValueOnce(
      new FeatureGateDeniedError("ai_suggest_voice")
    );
    const result = await suggestFromAudioAction(makeAudioFormData());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UPGRADE_REQUIRED");
      expect(result.feature).toBe("ai_suggest_voice");
    }
  });

  it("returns ok with the suggestion on success and forwards file metadata to the service", async () => {
    serviceMock.suggestMealFromAudio.mockResolvedValueOnce({
      name: "Chicken karahi",
      effortGuess: "medium",
      notes: "",
      recipeText: "ingredients\nsteps",
      confidence: "high"
    });
    const result = await suggestFromAudioAction(
      makeAudioFormData({ type: "audio/m4a", name: "voice-note-from-mom.m4a" })
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.name).toBe("Chicken karahi");
    expect(serviceMock.suggestMealFromAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaType: "audio/m4a",
        fileName: "voice-note-from-mom.m4a",
        userId: "u-1"
      })
    );
  });
});
