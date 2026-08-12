import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
    // legacy/ holds the frozen static build. Its node:test suite is kept for
    // reference and is deliberately not run here.
    exclude: ["node_modules/**", "legacy/**", ".next/**"],
  },
});
