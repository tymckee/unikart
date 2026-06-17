import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Vitest config for UniKart. Tests focus on the pure Ops logic (permissions,
 * host gate, sanitizer, metrics) — no DB or Next runtime required. The "@/"
 * alias mirrors tsconfig so test imports match app imports.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
  },
});
