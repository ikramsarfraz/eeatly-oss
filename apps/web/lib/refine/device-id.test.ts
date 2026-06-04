import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Round 22.5 — `getDeviceId` reads / writes the browser's
 * `window.localStorage` + `window.crypto.randomUUID`. Rather than spin
 * up a DOM environment for what is fundamentally two property lookups,
 * we stub the globals directly. This stays portable across vitest's
 * Node environment without depending on jsdom or happy-dom (Node 26's
 * own experimental localStorage interferes with both, so the stub
 * route is the cleanest).
 */

function makeFakeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null
  };
}

describe("getDeviceId", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = makeFakeStorage();
    vi.stubGlobal("window", {
      localStorage: storage,
      crypto: { randomUUID: () => "11111111-2222-3333-4444-555555555555" }
    });
    // getDeviceId now mints via lib/utils `randomUuid`, which reads
    // globalThis.crypto (in a browser that's the same object as window.crypto).
    vi.stubGlobal("crypto", {
      randomUUID: () => "11111111-2222-3333-4444-555555555555"
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mints a UUID on first call and persists it to localStorage", async () => {
    vi.resetModules();
    const { getDeviceId } = await import("./device-id");
    expect(storage.getItem("eeatly:device-id")).toBeNull();
    const id = getDeviceId();
    expect(id).toBe("11111111-2222-3333-4444-555555555555");
    expect(storage.getItem("eeatly:device-id")).toBe(
      "11111111-2222-3333-4444-555555555555"
    );
  });

  it("returns the persisted UUID on subsequent calls without re-minting", async () => {
    storage.setItem("eeatly:device-id", "preexisting-id");
    const randomUUID = vi.fn(() => "should-not-run");
    vi.stubGlobal("window", {
      localStorage: storage,
      crypto: { randomUUID }
    });
    vi.stubGlobal("crypto", { randomUUID });
    vi.resetModules();
    const { getDeviceId } = await import("./device-id");
    const id = getDeviceId();
    expect(id).toBe("preexisting-id");
    expect(randomUUID).not.toHaveBeenCalled();
  });

  it("returns the same value across two synchronous calls", async () => {
    vi.resetModules();
    const { getDeviceId } = await import("./device-id");
    const first = getDeviceId();
    const second = getDeviceId();
    expect(second).toBe(first);
  });
});

describe("getDeviceId (SSR)", () => {
  // SSR check: when there's no `window`, the helper must return an
  // empty string so it can be referenced in client-component module
  // bodies without crashing during the Next.js pre-render.
  it("returns an empty string when `window` is undefined", async () => {
    vi.stubGlobal("window", undefined);
    vi.resetModules();
    const { getDeviceId } = await import("./device-id");
    expect(getDeviceId()).toBe("");
    vi.unstubAllGlobals();
  });
});
