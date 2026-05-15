import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Proxy db mock — same shape as services/households.test.ts. No transactions
// in services/ai.ts so the transaction-callback override isn't needed.
const dbState = vi.hoisted(() => {
  const queue: Array<() => Promise<unknown>> = [];

  type Chain = ((...args: unknown[]) => Chain) & PromiseLike<unknown> & {
    [key: string]: unknown;
  };

  function makeChain(): Chain {
    const handler: ProxyHandler<Chain> = {
      get(_target, prop) {
        if (prop === "then") {
          return (
            onFulfilled?: (v: unknown) => unknown,
            onRejected?: (e: unknown) => unknown
          ) => {
            const resolver = queue.shift();
            if (!resolver) {
              return Promise.reject(
                new Error("dbState: queue empty — test forgot to enqueue a result.")
              ).then(onFulfilled, onRejected);
            }
            return resolver().then(onFulfilled, onRejected);
          };
        }
        // Return proxy directly (not `() => proxy`) so the `db.query.X.findFirst`
        // pattern works the same as `db.select(...).from(...)`. The proxy is
        // both callable (via apply) AND has gettable properties — both walks
        // converge on the same drainable promise.
        return proxy;
      },
      apply: () => proxy
    };
    const fn: unknown = () => proxy;
    const proxy = new Proxy(fn as Chain, handler);
    return proxy;
  }

  const chain = makeChain();
  return { chain, queue };
});

vi.mock("@/lib/db/client", () => ({ db: dbState.chain }));

// Short-circuit lib/auth/index.ts env validation (services/ai.ts imports
// requireHouseholdMember which transitively pulls auth/index.ts at module
// load). The auth mock is for module-load only; the session mock is the
// surface this test actually exercises.
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => null } }
}));

const sessionMock = vi.hoisted(() => ({
  requireHouseholdMember: vi.fn<(userId: string, householdId: string) => Promise<void>>()
}));

vi.mock("@/lib/auth/session", () => sessionMock);

// Round 6: generateShareableRecipe also calls requireFeatureAccess.
// Permissive stub; the feature-gate behavior is exercised in
// lib/gates/resolver.test.ts.
const gateMock = vi.hoisted(() => ({
  requireFeatureAccess: vi.fn<(userId: string, feature: string) => Promise<void>>(),
  can: vi.fn<(userId: string, feature: string) => Promise<boolean>>()
}));
vi.mock("@/lib/gates/resolver", () => gateMock);

// withFallback returns whatever the primary resolves to — short-circuit it
// so this test doesn't reach the OpenAI/Anthropic providers (and so this
// test doesn't need OPENAI_API_KEY). We don't exercise the provider path
// here; lib/ai/providers/index.test.ts owns that.
vi.mock("@/lib/ai/providers", () => ({
  withFallback: vi.fn(async (primary: () => Promise<unknown>) => primary())
}));

const openaiMock = vi.hoisted(() => ({
  generateShareText: vi.fn(async () => ({ text: "share text" })),
  suggestMealFromVoiceTranscript: vi.fn(async () => ({
    name: "Chicken karahi",
    effortGuess: "medium",
    notes: "Sear the masala before adding water.",
    recipeText: "ingredients\nsteps",
    confidence: "high"
  })),
  transcribeAudio: vi.fn(async () => "raw whisper output"),
  extractIngredientsFromText: vi.fn(async () => ["1 cup basmati rice", "2 tbsp ghee"])
}));
vi.mock("@/lib/ai/providers/openai", () => openaiMock);

vi.mock("@/lib/ai/providers/anthropic", () => ({
  generateShareText: vi.fn(async () => ({ text: "share text" })),
  suggestMealFromVoiceTranscript: vi.fn(async () => ({
    name: "Chicken karahi",
    effortGuess: "medium",
    notes: "Sear the masala before adding water.",
    recipeText: "ingredients\nsteps",
    confidence: "high"
  })),
  extractIngredientsFromText: vi.fn(async () => ["1 cup basmati rice", "2 tbsp ghee"])
}));

import {
  extractIngredientsForMeal,
  generateShareableRecipe,
  suggestMealFromAudio
} from "./ai";
import {
  AudioInvalidFormatError,
  AudioTooLargeError,
  AudioTooShortOrEmptyError,
  AudioTranscriptionFailedError
} from "@/lib/errors/audio";
import { NoRecipeTextError } from "@/lib/errors/ingredients";

function queue<T>(value: T) {
  dbState.queue.push(async () => value);
}

beforeEach(() => {
  dbState.queue.length = 0;
  sessionMock.requireHouseholdMember.mockReset();
  sessionMock.requireHouseholdMember.mockResolvedValue();
  gateMock.requireFeatureAccess.mockReset();
  gateMock.requireFeatureAccess.mockResolvedValue();
  gateMock.can.mockReset();
  gateMock.can.mockResolvedValue(true);
});

afterEach(() => {
  expect(dbState.queue, "unused queued db results").toHaveLength(0);
});

describe("generateShareableRecipe service-layer authz", () => {
  it("calls requireHouseholdMember before touching the meal", async () => {
    // Mock will reject — the meal lookup queue should remain untouched.
    sessionMock.requireHouseholdMember.mockRejectedValueOnce(
      new Error("Not authorized for this household.")
    );

    await expect(
      generateShareableRecipe("u-stranger", "h-other", "m-1")
    ).rejects.toThrow(/Not authorized/);

    expect(sessionMock.requireHouseholdMember).toHaveBeenCalledWith("u-stranger", "h-other");
    // If the service had skipped the gate and reached the meal lookup,
    // afterEach would catch the queue mismatch — but additionally:
    expect(dbState.queue).toHaveLength(0);
  });

  it("permits the meal lookup when the member check passes", async () => {
    // Two reads: meal + household join, then the latest log lookup.
    queue([
      {
        id: "m-1",
        name: "Soy ginger noodles",
        recipeText: "ingredients...\n\nsteps...",
        householdName: "Test Kitchen"
      }
    ]);
    queue(undefined); // latest log .findFirst returns undefined when no logs

    const result = await generateShareableRecipe("u-member", "h-a", "m-1");

    expect(result).toEqual({ ok: true, text: "share text" });
    expect(sessionMock.requireHouseholdMember).toHaveBeenCalledWith("u-member", "h-a");
  });
});

describe("suggestMealFromAudio", () => {
  // Re-using the existing module-level mocks for providers + gate.
  // A "transcriber" stub is injected per-test via the `deps` argument so
  // we exercise the service flow without touching the OpenAI SDK.

  function tinyBuffer(bytes: number): Buffer {
    return Buffer.alloc(bytes, 0x01);
  }

  it("fails the gate check before touching the transcriber", async () => {
    const transcriber = { transcribe: vi.fn() };
    gateMock.requireFeatureAccess.mockRejectedValueOnce(new Error("gated"));

    await expect(
      suggestMealFromAudio(
        {
          audioBuffer: tinyBuffer(1024),
          mediaType: "audio/webm",
          userId: "u-free"
        },
        { transcriber }
      )
    ).rejects.toThrow(/gated/);

    expect(transcriber.transcribe).not.toHaveBeenCalled();
  });

  it("throws AudioInvalidFormatError for an unsupported media type", async () => {
    const transcriber = { transcribe: vi.fn() };
    await expect(
      suggestMealFromAudio(
        {
          audioBuffer: tinyBuffer(1024),
          mediaType: "audio/aiff",
          userId: "u-1"
        },
        { transcriber }
      )
    ).rejects.toBeInstanceOf(AudioInvalidFormatError);
    expect(transcriber.transcribe).not.toHaveBeenCalled();
  });

  it("throws AudioTooLargeError when the buffer exceeds 25 MB", async () => {
    const transcriber = { transcribe: vi.fn() };
    // Build a buffer just over the 25 MB cap. Skip the allocation if
    // memory is tight by patching `byteLength` — but in practice Buffer
    // allocs of this size are fine on test runners. 25 * 1024 * 1024 + 1.
    const oversized = Buffer.alloc(25 * 1024 * 1024 + 1, 0x01);
    await expect(
      suggestMealFromAudio(
        { audioBuffer: oversized, mediaType: "audio/mpeg", userId: "u-1" },
        { transcriber }
      )
    ).rejects.toBeInstanceOf(AudioTooLargeError);
    expect(transcriber.transcribe).not.toHaveBeenCalled();
  });

  it("throws AudioTooShortOrEmptyError for an empty buffer (zero bytes)", async () => {
    const transcriber = { transcribe: vi.fn() };
    await expect(
      suggestMealFromAudio(
        { audioBuffer: Buffer.alloc(0), mediaType: "audio/webm", userId: "u-1" },
        { transcriber }
      )
    ).rejects.toBeInstanceOf(AudioTooShortOrEmptyError);
    expect(transcriber.transcribe).not.toHaveBeenCalled();
  });

  it("throws AudioTranscriptionFailedError when Whisper rejects", async () => {
    const transcriber = {
      transcribe: vi.fn(async () => {
        throw new Error("whisper 500");
      })
    };
    await expect(
      suggestMealFromAudio(
        { audioBuffer: tinyBuffer(2048), mediaType: "audio/webm", userId: "u-1" },
        { transcriber }
      )
    ).rejects.toBeInstanceOf(AudioTranscriptionFailedError);
    expect(transcriber.transcribe).toHaveBeenCalledOnce();
  });

  it("throws AudioTooShortOrEmptyError when Whisper returns a transcript that's too short", async () => {
    const transcriber = { transcribe: vi.fn(async () => "hi") };
    await expect(
      suggestMealFromAudio(
        { audioBuffer: tinyBuffer(2048), mediaType: "audio/webm", userId: "u-1" },
        { transcriber }
      )
    ).rejects.toBeInstanceOf(AudioTooShortOrEmptyError);
  });

  it("passes the trimmed transcript to the extraction provider and returns the suggestion", async () => {
    const transcriber = {
      transcribe: vi.fn(
        async () =>
          "  Today I'll make chicken karahi — first heat ghee in a heavy pan and add tomatoes...   "
      )
    };
    const result = await suggestMealFromAudio(
      { audioBuffer: tinyBuffer(2048), mediaType: "audio/webm", userId: "u-1" },
      { transcriber }
    );
    expect(result.name).toBe("Chicken karahi");
    expect(transcriber.transcribe).toHaveBeenCalledWith(
      expect.any(Buffer),
      "audio/webm",
      expect.stringMatching(/\.webm$/)
    );
  });

  it("uses the caller-supplied fileName when present (passes through to transcriber)", async () => {
    const transcriber = {
      transcribe: vi.fn(
        async () =>
          "Today I'll make chicken karahi — heat ghee, add tomatoes, simmer for 20 minutes."
      )
    };
    await suggestMealFromAudio(
      {
        audioBuffer: tinyBuffer(2048),
        mediaType: "audio/m4a",
        fileName: "voice-note-from-mom.m4a",
        userId: "u-1"
      },
      { transcriber }
    );
    expect(transcriber.transcribe).toHaveBeenCalledWith(
      expect.any(Buffer),
      "audio/m4a",
      "voice-note-from-mom.m4a"
    );
  });
});

describe("extractIngredientsForMeal (Round 10)", () => {
  beforeEach(() => {
    openaiMock.extractIngredientsFromText.mockClear();
    openaiMock.extractIngredientsFromText.mockResolvedValue([
      "1 cup basmati rice",
      "2 tbsp ghee"
    ]);
  });

  it("rejects non-members BEFORE the gate or meal lookup runs", async () => {
    sessionMock.requireHouseholdMember.mockRejectedValueOnce(
      new Error("Not authorized for this household.")
    );

    await expect(
      extractIngredientsForMeal({
        userId: "u-stranger",
        householdId: "h-other",
        mealId: "m-1"
      })
    ).rejects.toThrow(/Not authorized/);

    expect(gateMock.requireFeatureAccess).not.toHaveBeenCalled();
    expect(openaiMock.extractIngredientsFromText).not.toHaveBeenCalled();
    expect(dbState.queue).toHaveLength(0);
  });

  it("rejects on a denied feature gate BEFORE touching the AI provider", async () => {
    gateMock.requireFeatureAccess.mockRejectedValueOnce(new Error("gated"));

    await expect(
      extractIngredientsForMeal({
        userId: "u-free",
        householdId: "h-a",
        mealId: "m-1"
      })
    ).rejects.toThrow(/gated/);

    expect(openaiMock.extractIngredientsFromText).not.toHaveBeenCalled();
    expect(dbState.queue).toHaveLength(0);
  });

  it("throws NoRecipeTextError when the meal row is missing", async () => {
    queue([]); // meal lookup returns []

    await expect(
      extractIngredientsForMeal({
        userId: "u-member",
        householdId: "h-a",
        mealId: "m-missing"
      })
    ).rejects.toBeInstanceOf(NoRecipeTextError);

    expect(openaiMock.extractIngredientsFromText).not.toHaveBeenCalled();
  });

  it("throws NoRecipeTextError when the meal exists but has no recipeText", async () => {
    queue([{ id: "m-1", recipeText: null }]);

    await expect(
      extractIngredientsForMeal({
        userId: "u-member",
        householdId: "h-a",
        mealId: "m-1"
      })
    ).rejects.toBeInstanceOf(NoRecipeTextError);

    expect(openaiMock.extractIngredientsFromText).not.toHaveBeenCalled();
  });

  it("extracts, persists the cleaned list, and returns it on the happy path", async () => {
    queue([{ id: "m-1", recipeText: "1 cup rice. 2 tbsp ghee. Cook." }]);
    queue([{ id: "m-1" }]); // the update returning row

    const result = await extractIngredientsForMeal({
      userId: "u-member",
      householdId: "h-a",
      mealId: "m-1"
    });

    expect(result).toEqual(["1 cup basmati rice", "2 tbsp ghee"]);
    expect(openaiMock.extractIngredientsFromText).toHaveBeenCalledWith(
      "1 cup rice. 2 tbsp ghee. Cook."
    );
  });

  it("filters empty entries and trims whitespace before persisting", async () => {
    queue([{ id: "m-1", recipeText: "method here" }]);
    queue([{ id: "m-1" }]);
    openaiMock.extractIngredientsFromText.mockResolvedValueOnce([
      "  ",
      "  1 cup rice  ",
      ""
    ]);

    const result = await extractIngredientsForMeal({
      userId: "u-member",
      householdId: "h-a",
      mealId: "m-1"
    });

    expect(result).toEqual(["1 cup rice"]);
  });
});
