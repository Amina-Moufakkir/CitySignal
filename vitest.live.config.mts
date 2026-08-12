import { defineConfig } from "vitest/config";

/** Live verification only. Kept out of `npm test` and out of CI. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/verify-live.test.ts"],
    testTimeout: 120_000,
  },
});
