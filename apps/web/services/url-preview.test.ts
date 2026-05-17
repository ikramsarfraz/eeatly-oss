/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Round 16 — URL preview service tests.
 *
 * Strategy: stub the DB (reuse the queue-proxy pattern from ai.test),
 * mock `dns/promises.lookup`, and mock global fetch. We assert:
 *   - Scheme defense rejects file://, gopher://, etc.
 *   - SSRF defense rejects URLs that resolve to private IPs
 *   - Cache hit returns without re-fetching
 *   - Success caching writes a row with errorCode=null
 *   - Failure caching writes a row with the right errorCode
 */

const dnsLookup = vi.hoisted(() => vi.fn());
vi.mock("node:dns/promises", () => ({ lookup: dnsLookup }));

// Same db proxy pattern used in services/ai.test.ts.
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
                new Error("dbState: queue empty — test forgot to enqueue.")
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

// open-graph-scraper is stubbed per-test. Default: returns one good result.
const ogsMock = vi.hoisted(() =>
  vi.fn(async () => ({
    error: false,
    result: {
      ogTitle: "A recipe page",
      ogDescription: "A great recipe",
      ogImage: [{ url: "https://cdn.example.com/img.jpg" }]
    }
  }))
);
vi.mock("open-graph-scraper", () => ({ default: ogsMock }));

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

function makeBodyStream(text: string) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    }
  });
}

beforeEach(() => {
  dbState.queue.length = 0;
  dnsLookup.mockReset();
  ogsMock.mockClear();
  fetchMock = vi.fn(async () =>
    new Response(makeBodyStream("<html></html>"), {
      status: 200,
      headers: { "Content-Type": "text/html" }
    })
  );
  globalThis.fetch = fetchMock as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  expect(dbState.queue, "unused queued db results").toHaveLength(0);
});

function queue<T>(value: T) {
  dbState.queue.push(async () => value);
}

import { getUrlPreview } from "./url-preview";

describe("getUrlPreview — scheme defense", () => {
  it("rejects file:// URLs without touching the cache or network", async () => {
    await expect(getUrlPreview("file:///etc/passwd")).rejects.toMatchObject({
      code: "URL_INVALID"
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dnsLookup).not.toHaveBeenCalled();
  });

  it("rejects gopher:// without network", async () => {
    await expect(getUrlPreview("gopher://internal/")).rejects.toMatchObject({
      code: "URL_INVALID"
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects javascript: URIs", async () => {
    await expect(getUrlPreview("javascript:alert(1)")).rejects.toMatchObject({
      code: "URL_INVALID"
    });
  });
});

describe("getUrlPreview — SSRF defense", () => {
  it("rejects loopback IPs (127.0.0.1)", async () => {
    queue([]); // cache miss
    dnsLookup.mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    queue(undefined); // failure cache insert

    await expect(
      getUrlPreview("http://localhost.example/test")
    ).rejects.toMatchObject({ code: "URL_PRIVATE_NETWORK" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects RFC 1918 IPs (10.0.0.1)", async () => {
    queue([]);
    dnsLookup.mockResolvedValueOnce([{ address: "10.0.0.1", family: 4 }]);
    queue(undefined);

    await expect(
      getUrlPreview("http://intranet.example/x")
    ).rejects.toMatchObject({ code: "URL_PRIVATE_NETWORK" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects AWS metadata IP (169.254.169.254) — the canonical SSRF target", async () => {
    queue([]);
    dnsLookup.mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }]);
    queue(undefined);

    await expect(
      getUrlPreview("http://metadata.example/")
    ).rejects.toMatchObject({ code: "URL_PRIVATE_NETWORK" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects when ANY resolved IP is private (multi-record DNS)", async () => {
    queue([]);
    // First record is public — but the second is private. We must
    // reject because the OS resolver could pick either one when we
    // fetch.
    dnsLookup.mockResolvedValueOnce([
      { address: "1.1.1.1", family: 4 },
      { address: "10.0.0.1", family: 4 }
    ]);
    queue(undefined);

    await expect(
      getUrlPreview("http://example.com/x")
    ).rejects.toMatchObject({ code: "URL_PRIVATE_NETWORK" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getUrlPreview — cache behavior", () => {
  it("returns a fresh cache hit without re-fetching", async () => {
    queue([
      {
        url: "https://example.com/recipe",
        title: "Cached Title",
        description: "Cached desc",
        imageUrl: "https://cdn.example.com/img.jpg",
        hostName: "example.com",
        fetchedAt: new Date(),
        errorCode: null
      }
    ]);

    const preview = await getUrlPreview("https://example.com/recipe");

    expect(preview.title).toBe("Cached Title");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(dnsLookup).not.toHaveBeenCalled();
  });

  it("re-throws the typed error from a cached failure row", async () => {
    queue([
      {
        url: "https://broken.example/x",
        title: null,
        description: null,
        imageUrl: null,
        hostName: "broken.example",
        fetchedAt: new Date(),
        errorCode: "URL_NO_METADATA"
      }
    ]);

    await expect(
      getUrlPreview("https://broken.example/x")
    ).rejects.toMatchObject({ code: "URL_NO_METADATA" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("ignores cache entries past the success TTL (>7d)", async () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    queue([
      {
        url: "https://example.com/recipe",
        title: "Stale title",
        description: null,
        imageUrl: null,
        hostName: "example.com",
        fetchedAt: eightDaysAgo,
        errorCode: null
      }
    ]);
    dnsLookup.mockResolvedValueOnce([{ address: "1.1.1.1", family: 4 }]);
    queue(undefined); // success cache write

    const preview = await getUrlPreview("https://example.com/recipe");

    expect(preview.title).toBe("A recipe page");
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("ignores cache entries past the failure TTL (>1h)", async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    queue([
      {
        url: "https://flaky.example/x",
        title: null,
        description: null,
        imageUrl: null,
        hostName: "flaky.example",
        fetchedAt: twoHoursAgo,
        errorCode: "URL_FETCH_FAILED"
      }
    ]);
    dnsLookup.mockResolvedValueOnce([{ address: "1.1.1.1", family: 4 }]);
    queue(undefined); // success cache write

    const preview = await getUrlPreview("https://flaky.example/x");
    expect(preview.title).toBe("A recipe page");
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("getUrlPreview — happy path", () => {
  it("fetches, parses OG, and persists a success row", async () => {
    queue([]); // cache miss
    dnsLookup.mockResolvedValueOnce([{ address: "1.1.1.1", family: 4 }]);
    queue(undefined); // upsert

    const preview = await getUrlPreview(
      "https://cooking.nytimes.com/recipes/123"
    );

    expect(preview.title).toBe("A recipe page");
    expect(preview.description).toBe("A great recipe");
    expect(preview.imageUrl).toBe("https://cdn.example.com/img.jpg");
    expect(preview.hostName).toBe("cooking.nytimes.com");
    expect(ogsMock).toHaveBeenCalledOnce();
  });
});

describe("getUrlPreview — no metadata", () => {
  it("throws URL_NO_METADATA when OG extracts nothing useful", async () => {
    queue([]); // cache miss
    dnsLookup.mockResolvedValueOnce([{ address: "1.1.1.1", family: 4 }]);
    ogsMock.mockResolvedValueOnce({
      error: false,
      result: { ogTitle: undefined, ogDescription: undefined, ogImage: undefined }
    } as never);
    queue(undefined); // failure cache write

    await expect(
      getUrlPreview("https://barren.example/")
    ).rejects.toMatchObject({ code: "URL_NO_METADATA" });
  });
});
