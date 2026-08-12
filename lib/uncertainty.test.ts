import { describe, expect, test } from "vitest";

import { PHASE3_BOARD_DATASET } from "./static-data";
import { topBoardShare } from "./analysis";
import {
  bootstrapPercentageDifference,
  bootstrapTopShare,
  comparedToThreshold,
} from "./uncertainty";

const BOARD_COUNTS = PHASE3_BOARD_DATASET.rows.map((row) => row.saturdayNightComplaints);

describe("bootstrapPercentageDifference", () => {
  test("brackets the point estimate", () => {
    const weekday = Array.from({ length: 260 }, (_unused, index) => 200 + (index % 40));
    const weekend = Array.from({ length: 104 }, (_unused, index) => 360 + (index % 60));

    const interval = bootstrapPercentageDifference(weekday, weekend);

    expect(interval.kind).toBe("interval");
    if (interval.kind !== "interval") return;
    expect(interval.lower).toBeLessThan(interval.point);
    expect(interval.upper).toBeGreaterThan(interval.point);
    expect(interval.level).toBe(0.95);
  });

  test("is deterministic for a given seed", () => {
    const weekday = Array.from({ length: 60 }, (_unused, index) => 10 + (index % 7));
    const weekend = Array.from({ length: 24 }, (_unused, index) => 18 + (index % 5));

    const first = bootstrapPercentageDifference(weekday, weekend, { seed: 42, draws: 500 });
    const second = bootstrapPercentageDifference(weekday, weekend, { seed: 42, draws: 500 });
    const different = bootstrapPercentageDifference(weekday, weekend, { seed: 43, draws: 500 });

    expect(first).toEqual(second);
    expect(first).not.toEqual(different);
  });

  test("narrows as the sample grows", () => {
    const small = bootstrapPercentageDifference(
      Array.from({ length: 20 }, (_unused, index) => 100 + (index % 50)),
      Array.from({ length: 8 }, (_unused, index) => 180 + (index % 50)),
    );
    const large = bootstrapPercentageDifference(
      Array.from({ length: 2000 }, (_unused, index) => 100 + (index % 50)),
      Array.from({ length: 800 }, (_unused, index) => 180 + (index % 50)),
    );

    expect(small.kind).toBe("interval");
    expect(large.kind).toBe("interval");
    if (small.kind !== "interval" || large.kind !== "interval") return;
    expect(large.upper - large.lower).toBeLessThan(small.upper - small.lower);
  });

  test("is unavailable rather than infinite when the baseline is zero", () => {
    expect(bootstrapPercentageDifference([0, 0, 0], [5, 6, 7])).toEqual({ kind: "unavailable" });
  });

  test("is unavailable when either sample is empty", () => {
    expect(bootstrapPercentageDifference([], [1, 2])).toEqual({ kind: "unavailable" });
    expect(bootstrapPercentageDifference([1, 2], [])).toEqual({ kind: "unavailable" });
  });
});

describe("bootstrapTopShare", () => {
  // Pinned against the committed board data. The point estimate is the README's
  // 38.0%; the interval is what this repository can actually support.
  test("reproduces the top-three concentration interval", () => {
    const interval = bootstrapTopShare(BOARD_COUNTS, 3);

    expect(interval.kind).toBe("interval");
    if (interval.kind !== "interval") return;
    expect(Number(interval.point.toFixed(2))).toBe(37.99);
    expect(interval.point).toBeCloseTo(topBoardShare(3).share, 10);
    expect(interval.lower).toBeGreaterThan(36.5);
    expect(interval.upper).toBeLessThan(39.5);
    expect(interval.draws).toBe(2000);
  });

  // The honest reading of the pre-registered 40% test. Treating complaints as
  // independent, the interval sits entirely below the threshold. That assumption
  // is optimistic - complaints cluster within nights - and the Method section
  // says so, but the arithmetic this repository can support says "below", not
  // "unresolved".
  test("places the interval entirely below the pre-registered 40% threshold", () => {
    const interval = bootstrapTopShare(BOARD_COUNTS, 3);

    expect(comparedToThreshold(interval, 40)).toBe("entirely-below");
  });

  test("is deterministic for a given seed", () => {
    const first = bootstrapTopShare(BOARD_COUNTS, 3, { seed: 7, draws: 200 });
    const second = bootstrapTopShare(BOARD_COUNTS, 3, { seed: 7, draws: 200 });

    expect(first).toEqual(second);
  });

  test("a wider top-N holds a larger share", () => {
    const three = bootstrapTopShare(BOARD_COUNTS, 3, { draws: 200 });
    const six = bootstrapTopShare(BOARD_COUNTS, 6, { draws: 200 });

    expect(three.kind).toBe("interval");
    expect(six.kind).toBe("interval");
    if (three.kind !== "interval" || six.kind !== "interval") return;
    expect(six.point).toBeGreaterThan(three.point);
  });

  test("is unavailable for empty or zero input", () => {
    expect(bootstrapTopShare([], 3)).toEqual({ kind: "unavailable" });
    expect(bootstrapTopShare([0, 0], 3)).toEqual({ kind: "unavailable" });
    expect(bootstrapTopShare([1, 2], 0)).toEqual({ kind: "unavailable" });
  });
});

describe("comparedToThreshold", () => {
  test("reports which side of a threshold an interval falls on", () => {
    const interval = bootstrapTopShare(BOARD_COUNTS, 3, { draws: 200 });

    expect(comparedToThreshold(interval, 40)).toBe("entirely-below");
    expect(comparedToThreshold(interval, 10)).toBe("entirely-above");
    expect(comparedToThreshold(interval, 38)).toBe("straddles");
    expect(comparedToThreshold({ kind: "unavailable" }, 40)).toBe("unavailable");
  });
});
