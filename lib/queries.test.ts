import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { BOROUGHS, PRIMARY_RANGE, RANGES, STRESS_RANGE } from "./config";
import { dailyUrl, descriptorNightUrl, hourlyUrl, REVALIDATE_SECONDS } from "./socrata";

/**
 * `analysis/queries.md` publishes the exact query strings so a reader can re-run
 * them. A document that drifts from the code is worse than no document, so this
 * pins the two together: change a query builder without updating the file and
 * the suite fails.
 */
const DOC = readFileSync(join(process.cwd(), "analysis", "queries.md"), "utf8");

describe("analysis/queries.md", () => {
  test("publishes the daily query exactly as the code builds it", () => {
    expect(DOC).toContain(decodeURIComponent(dailyUrl(PRIMARY_RANGE)));
  });

  test("publishes the hourly query exactly as the code builds it", () => {
    expect(DOC).toContain(decodeURIComponent(hourlyUrl(PRIMARY_RANGE)));
  });

  test("publishes the descriptor query exactly as the code builds it", () => {
    expect(DOC).toContain(decodeURIComponent(descriptorNightUrl(PRIMARY_RANGE)));
  });

  test("publishes the stress-period substitution exactly as the code builds it", () => {
    expect(DOC).toContain(decodeURIComponent(dailyUrl(STRESS_RANGE)));
  });

  test("states the configured periods", () => {
    for (const range of RANGES) {
      expect(DOC, range.label).toContain(range.start);
      expect(DOC, range.label).toContain(range.endExclusive);
    }
  });

  test("lists every borough the app can query", () => {
    for (const borough of BOROUGHS) {
      expect(DOC, borough.value).toContain(borough.value);
    }
  });

  test("states the revalidation window in hours", () => {
    expect(DOC).toContain(`${REVALIDATE_SECONDS / 3600} hours`);
  });

  // The point of the file is that unreproducible figures are named rather than
  // left for a reader to discover.
  test("labels every figure with a source", () => {
    for (const marker of ["Live", "Committed", "Phase 2\u20133"]) {
      expect(DOC.includes(marker), marker).toBe(true);
    }

    expect(DOC).toContain("Not reproducible here");
    expect(DOC).toContain("no committed derivation");
  });

  test("records that the board extraction date is unknown rather than inventing one", () => {
    expect(DOC).toContain("not recorded");
  });
});
