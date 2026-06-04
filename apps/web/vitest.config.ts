import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    // Default env is happy-dom so component / RTL tests work without a
    // per-file pragma. Pure-function tests stub the globals they need
    // (see `lib/refine/device-id.test.ts`) so the env choice doesn't
    // affect them. Vitest 4 dropped `environmentMatchGlobs`, so a
    // single default is the cleanest.
    environment: "happy-dom",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next", "drizzle"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      reporter: ["text", "html"],
      include: ["lib/**/*.ts", "services/**/*.ts", "components/**/*.tsx"],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "**/index.ts"]
    }
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` throws as soon as it's imported outside a server
      // component / handler context. In the Node test runtime there's no
      // such boundary — alias to a no-op so service imports work.
      "server-only": fileURLToPath(new URL("./vitest.server-only-stub.ts", import.meta.url))
    }
  }
});
