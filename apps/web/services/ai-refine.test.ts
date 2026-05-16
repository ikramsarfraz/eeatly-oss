import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AI refine tests don't need DB access — mock the client at the import
// path so the module-load doesn't drag in @neondatabase/serverless.
vi.mock("@/lib/db/client", () => ({
  db: new Proxy(() => undefined, {
    get: () => () => undefined,
    apply: () => undefined
  })
}));

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: async () => null } }
}));

const gateMock = vi.hoisted(() => ({
  requireFeatureAccess: vi.fn<(userId: string, feature: string) => Promise<void>>(),
  can: vi.fn<(userId: string, feature: string) => Promise<boolean>>()
}));
vi.mock("@/lib/gates/resolver", () => gateMock);

const withFallbackMock = vi.hoisted(() => ({
  withFallback: vi.fn(async (primary: () => Promise<unknown>) => primary())
}));
vi.mock("@/lib/ai/providers", () => withFallbackMock);

type RefineCall = {
  recipeJson: string;
  instruction: string;
  image?: { base64: string; mediaType: string };
};
type RefineResponse = {
  proposed: Array<Record<string, unknown>>;
  rationale?: string;
};

const openaiMock = vi.hoisted(() => ({
  proposeRefineChanges: vi.fn<(args: {
    recipeJson: string;
    instruction: string;
    image?: { base64: string; mediaType: string };
  }) => Promise<{ proposed: Array<Record<string, unknown>>; rationale?: string }>>(
    async () => ({
      proposed: [
        {
          id: "c1",
          kind: "change",
          target: "ingredient",
          refId: "i-chicken",
          field: "quantityString",
          before: "400 g",
          after: "600 g"
        }
      ],
      rationale: "Bumped chicken qty."
    })
  ),
  transcribeAudio: vi.fn(async () => "Bump the chicken to 600 grams please.")
}));
vi.mock("@/lib/ai/providers/openai", () => openaiMock);

vi.mock("@/lib/ai/providers/anthropic", () => ({
  proposeRefineChanges: vi.fn(async () => ({
    proposed: [],
    rationale: ""
  }))
}));

import {
  proposeChangesFromPhoto,
  proposeChangesFromText,
  proposeChangesFromVoice,
  type RecipeContext
} from "./ai-refine";
import {
  AudioInvalidFormatError,
  AudioTooLargeError,
  AudioTooShortOrEmptyError
} from "@/lib/errors/audio";

function baseRecipe(): RecipeContext {
  return {
    id: "m-1",
    name: "Chowmein Noodles",
    effortLevel: "medium",
    ingredients: [
      {
        id: "i-chicken",
        position: 0,
        name: "Chicken",
        quantityString: "400 g",
        prepNote: "boneless, sliced"
      }
    ],
    steps: []
  };
}

beforeEach(() => {
  gateMock.requireFeatureAccess.mockReset();
  gateMock.requireFeatureAccess.mockResolvedValue();
  openaiMock.proposeRefineChanges.mockClear();
  openaiMock.transcribeAudio.mockClear();
  withFallbackMock.withFallback.mockClear();
  withFallbackMock.withFallback.mockImplementation(
    async (primary: () => Promise<unknown>) => primary()
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("proposeChangesFromText", () => {
  it("validates the AI response shape and returns the proposed diff", async () => {
    const result = await proposeChangesFromText({
      userId: "u-1",
      recipe: baseRecipe(),
      prompt: "Bump chicken to 600 g"
    });
    expect(result.proposed).toHaveLength(1);
    expect(result.proposed[0]).toMatchObject({
      kind: "change",
      target: "ingredient",
      refId: "i-chicken"
    });
    expect(gateMock.requireFeatureAccess).toHaveBeenCalledWith(
      "u-1",
      "ai_suggest_text"
    );
  });

  it("passes the recipe JSON + instruction to the provider", async () => {
    await proposeChangesFromText({
      userId: "u-1",
      recipe: baseRecipe(),
      prompt: "Add ginger paste 1 tbsp"
    });
    expect(openaiMock.proposeRefineChanges).toHaveBeenCalledTimes(1);
    const call = openaiMock.proposeRefineChanges.mock.calls[0]?.[0] as
      | RefineCall
      | undefined;
    expect(call?.recipeJson).toContain("Chowmein Noodles");
    expect(call?.recipeJson).toContain("i-chicken");
    expect(call?.instruction).toBe("Add ginger paste 1 tbsp");
    expect(call?.image).toBeUndefined();
  });

  it("rejects when the feature gate denies", async () => {
    gateMock.requireFeatureAccess.mockRejectedValueOnce(
      new Error("upgrade required")
    );
    await expect(
      proposeChangesFromText({
        userId: "u-1",
        recipe: baseRecipe(),
        prompt: "any"
      })
    ).rejects.toThrow(/upgrade/i);
  });
});

describe("proposeChangesFromVoice", () => {
  it("transcribes audio + forwards transcript to the proposer", async () => {
    const audio = Buffer.from(new Uint8Array(1024));
    const result = await proposeChangesFromVoice({
      userId: "u-1",
      recipe: baseRecipe(),
      audioBuffer: audio,
      mediaType: "audio/m4a"
    });
    expect(result.transcript).toMatch(/600 grams/);
    expect(openaiMock.transcribeAudio).toHaveBeenCalled();
    expect(openaiMock.proposeRefineChanges).toHaveBeenCalledTimes(1);
    const proposerArg = openaiMock.proposeRefineChanges.mock.calls[0]?.[0] as
      | RefineCall
      | undefined;
    expect(proposerArg?.instruction).toMatch(/600 grams/);
  });

  it("rejects oversized audio without calling Whisper", async () => {
    const tooBig = Buffer.alloc(30 * 1024 * 1024);
    await expect(
      proposeChangesFromVoice({
        userId: "u-1",
        recipe: baseRecipe(),
        audioBuffer: tooBig,
        mediaType: "audio/m4a"
      })
    ).rejects.toBeInstanceOf(AudioTooLargeError);
    expect(openaiMock.transcribeAudio).not.toHaveBeenCalled();
  });

  it("rejects unsupported media types", async () => {
    await expect(
      proposeChangesFromVoice({
        userId: "u-1",
        recipe: baseRecipe(),
        audioBuffer: Buffer.from("x"),
        mediaType: "audio/aiff"
      })
    ).rejects.toBeInstanceOf(AudioInvalidFormatError);
  });

  it("rejects an empty buffer", async () => {
    await expect(
      proposeChangesFromVoice({
        userId: "u-1",
        recipe: baseRecipe(),
        audioBuffer: Buffer.alloc(0),
        mediaType: "audio/m4a"
      })
    ).rejects.toBeInstanceOf(AudioTooShortOrEmptyError);
  });
});

describe("proposeChangesFromPhoto", () => {
  it("passes the image + recipe context to the vision-capable provider", async () => {
    await proposeChangesFromPhoto({
      userId: "u-1",
      recipe: baseRecipe(),
      imageBase64: "iVBORw0KGgo",
      mediaType: "image/png"
    });
    expect(openaiMock.proposeRefineChanges).toHaveBeenCalledTimes(1);
    const call = openaiMock.proposeRefineChanges.mock.calls[0]?.[0] as
      | RefineCall
      | undefined;
    expect(call?.image).toEqual({
      base64: "iVBORw0KGgo",
      mediaType: "image/png"
    });
    expect(call?.instruction).toMatch(/photo/i);
    expect(call?.recipeJson).toContain("Chowmein Noodles");
  });
});

// Reference `RefineResponse` so the unused-types linter doesn't flag it.
void (null as unknown as RefineResponse | undefined);
