import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the `@/*` path alias in tsconfig, so a component under test
    // resolves its imports the same way the application does.
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Charts are pure functions of their props, so they are rendered to static
    // markup and asserted on directly rather than through a browser.
    include: ["lib/**/*.test.ts", "components/**/*.test.tsx"],
    // legacy/ holds the frozen static build. Its node:test suite is kept for
    // reference and is deliberately not run here.
    exclude: ["node_modules/**", "legacy/**", ".next/**"],
  },
});
