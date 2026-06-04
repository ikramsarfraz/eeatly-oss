import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Proxy db mock — same FIFO-result-queue shape as services/meals.test.ts.
// Each awaited drizzle chain (select / insert.onConflictDoUpdate) dequeues
// the next enqueued value.
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

const envMock = vi.hoisted(() => ({
  hasR2Env: vi.fn<() => boolean>(),
  // gemini.hasGeminiKey() reads this; an empty env → no GEMINI_API_KEY → the
  // generation falls through to the mocked openai provider (the prior path).
  getServerEnv: vi.fn<() => { GEMINI_API_KEY?: string }>(() => ({}))
}));
vi.mock("@/lib/env/server", () => envMock);

const openaiMock = vi.hoisted(() => ({
  generateDishImage: vi.fn<(name: string) => Promise<{ base64: string }>>()
}));
vi.mock("@/lib/ai/providers/openai", () => openaiMock);

const r2Mock = vi.hoisted(() => ({
  uploadDishImage:
    vi.fn<(normalizedName: string, bytes: Buffer, contentType: string) => Promise<string>>()
}));
vi.mock("@/lib/storage/r2", () => r2Mock);

import { generateDishImageForName, getDishImage } from "./dish-images";

function queue<T>(value: T) {
  dbState.queue.push(async () => value);
}

beforeEach(() => {
  dbState.queue.length = 0;
  envMock.hasR2Env.mockReset();
  envMock.hasR2Env.mockReturnValue(true);
  openaiMock.generateDishImage.mockReset();
  r2Mock.uploadDishImage.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("getDishImage", () => {
  it("returns the URL for a ready row", async () => {
    queue([
      {
        normalizedName: "pasta",
        imageUrl: "https://r2.example/dish-images/abc.png",
        status: "ready",
        errorCode: null,
        model: "gpt-image-1",
        generatedAt: new Date()
      }
    ]);
    await expect(getDishImage("Pasta")).resolves.toBe(
      "https://r2.example/dish-images/abc.png"
    );
  });

  it("returns null when no row exists", async () => {
    queue([]);
    await expect(getDishImage("Unknown Dish")).resolves.toBeNull();
  });

  it("returns null for a failed row", async () => {
    queue([
      {
        normalizedName: "pasta",
        imageUrl: null,
        status: "failed",
        errorCode: "GENERATION_FAILED",
        model: "gpt-image-1",
        generatedAt: new Date()
      }
    ]);
    await expect(getDishImage("Pasta")).resolves.toBeNull();
  });
});

describe("generateDishImageForName", () => {
  it("returns the cached URL on a ready row without calling OpenAI", async () => {
    queue([{ status: "ready", imageUrl: "https://r2.example/cached.png" }]);

    await expect(generateDishImageForName("Pasta")).resolves.toBe(
      "https://r2.example/cached.png"
    );
    expect(openaiMock.generateDishImage).not.toHaveBeenCalled();
    expect(r2Mock.uploadDishImage).not.toHaveBeenCalled();
  });

  it("generates, uploads to R2, and upserts on a cache miss", async () => {
    queue([]); // cache read: no existing row
    openaiMock.generateDishImage.mockResolvedValue({ base64: "QUJD" }); // "ABC"
    r2Mock.uploadDishImage.mockResolvedValue("https://r2.example/new.png");
    queue(undefined); // the insert().onConflictDoUpdate() await

    await expect(generateDishImageForName("  Chicken  Curry ")).resolves.toBe(
      "https://r2.example/new.png"
    );

    // Normalized name is what reaches OpenAI + R2 (trim + collapse + lower).
    expect(openaiMock.generateDishImage).toHaveBeenCalledWith("chicken curry");
    const [normalizedArg, bytesArg, contentTypeArg] =
      r2Mock.uploadDishImage.mock.calls[0]!;
    expect(normalizedArg).toBe("chicken curry");
    expect(Buffer.isBuffer(bytesArg)).toBe(true);
    expect(contentTypeArg).toBe("image/png");
  });

  it("returns null without generating when R2 is not configured", async () => {
    envMock.hasR2Env.mockReturnValue(false);
    await expect(generateDishImageForName("Pasta")).resolves.toBeNull();
    expect(openaiMock.generateDishImage).not.toHaveBeenCalled();
  });

  it("caches a failure and returns null when generation throws", async () => {
    queue([]); // cache read: no row
    openaiMock.generateDishImage.mockRejectedValue(new Error("provider down"));
    queue(undefined); // the failure-cache insert await

    await expect(generateDishImageForName("Pasta")).resolves.toBeNull();
    expect(r2Mock.uploadDishImage).not.toHaveBeenCalled();
  });

  it("returns null for a name that normalizes to empty", async () => {
    await expect(generateDishImageForName("   ")).resolves.toBeNull();
    expect(openaiMock.generateDishImage).not.toHaveBeenCalled();
  });
});
