import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next", "drizzle"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      reporter: ["text", "html"],
      include: ["lib/**/*.ts", "services/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts"]
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
