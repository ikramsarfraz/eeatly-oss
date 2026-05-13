import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts", "**/*.test.tsx"],
    exclude: ["node_modules", ".next", "drizzle"],
    coverage: {
      reporter: ["text", "html"],
      include: ["lib/**/*.ts", "services/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts"]
    }
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url))
    }
  }
});
