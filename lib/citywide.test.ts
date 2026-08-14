import { describe, expect, it } from "vitest";

import {
  WEEKDAY_INDEX,
  buildBoroughRow,
  indexComparison,
  largestRise,
  orderBoroughRows,
  patternBreadth,
  type BoroughRow,
} from "./citywide";
import { summarize, type Comparison } from "./analysis";
import { CITYWIDE_BOROUGH_ORDER, rollingRange, type Borough } from "./config";

const computed = (weekday: number, weekend: number): Comparison => ({
  kind: "computed",
  weekdayAverage: weekday,
  weekendAverage: weekend,
  percentageDifference: ((weekend - weekday) / weekday) * 100,
  direction: weekend > weekday ? "higher" : weekend < weekday ? "lower" : "level",
});

function row(borough: Borough, comparison: Comparison): BoroughRow {
  return {
    borough,
    label: borough,
    index: indexComparison(comparison),
    comparison,
    weekdayDays: 260,
    weekendDays: 104,
    totalComplaints: 1000,
  };
}

describe("indexComparison", () => {
  it("always puts the weekday side at exactly 100", () => {
    for (const [weekday, weekend] of [
      [10, 20],
      [210.6, 374.5],
      [1, 1],
      [500, 100],
      [0.25, 0.3],
    ]) {
      const index = indexComparison(computed(weekday, weekend));

      expect(index.kind).toBe("computed");
      if (index.kind !== "computed") return;
      expect(index.weekdayIndex).toBe(WEEKDAY_INDEX);
      expect(index.weekdayIndex).toBe(100);
    }
  });

  it("puts the weekend side at the ratio of the two averages", () => {
    const index = indexComparison(computed(200, 350));

    expect(index.kind).toBe("computed");
    if (index.kind !== "computed") return;
    expect(index.weekendIndex).toBeCloseTo(175, 10);
    expect(index.percentageDifference).toBeCloseTo(75, 10);
  });

  it("keeps the index and the percentage consistent with each other", () => {
    const index = indexComparison(computed(210.6, 374.5));

    expect(index.kind).toBe("computed");
    if (index.kind !== "computed") return;
    expect(index.weekendIndex - WEEKDAY_INDEX).toBeCloseTo(index.percentageDifference, 10);
  });

  it("indexes a fall below the baseline", () => {
    const index = indexComparison(computed(100, 60));

    expect(index.kind).toBe("computed");
    if (index.kind !== "computed") return;
    expect(index.weekendIndex).toBeCloseTo(60, 10);
    expect(index.direction).toBe("lower");
  });

  it("refuses to index a missing weekday baseline", () => {
    expect(indexComparison({ kind: "zero-baseline", weekendAverage: 12 })).toEqual({
      kind: "no-baseline",
    });
  });

  it("refuses to index absent data", () => {
    expect(indexComparison({ kind: "no-data" })).toEqual({ kind: "no-data" });
  });
});

describe("orderBoroughRows", () => {
  it("returns all five boroughs exactly once, in the fixed order", () => {
    const rows = orderBoroughRows([
      row("QUEENS", computed(10, 12)),
      row("BRONX", computed(10, 11)),
      row("BROOKLYN", computed(10, 18)),
      row("STATEN ISLAND", computed(10, 10)),
      row("MANHATTAN", computed(10, 14)),
    ]);

    expect(rows.map((entry) => entry.borough)).toEqual([...CITYWIDE_BOROUGH_ORDER]);
    expect(new Set(rows.map((entry) => entry.borough)).size).toBe(5);
  });

  it("never sorts by result", () => {
    const ascending = orderBoroughRows([
      row("BRONX", computed(10, 11)),
      row("BROOKLYN", computed(10, 90)),
    ]);

    expect(ascending.map((entry) => entry.borough)).toEqual([...CITYWIDE_BOROUGH_ORDER]);
  });

  it("fills a borough that failed to load with a no-data row rather than dropping it", () => {
    const rows = orderBoroughRows([row("BROOKLYN", computed(10, 18))]);

    expect(rows).toHaveLength(5);
    expect(rows.filter((entry) => entry.index.kind === "no-data")).toHaveLength(4);
  });
});

describe("largestRise", () => {
  it("names the borough that rose furthest against its own baseline", () => {
    const result = largestRise([
      row("BRONX", computed(10, 13)),
      row("BROOKLYN", computed(10, 18)),
      row("QUEENS", computed(100, 150)),
    ]);

    expect(result.kind).toBe("leader");
    if (result.kind !== "leader") return;
    expect(result.borough).toBe("BROOKLYN");
    expect(result.percentageDifference).toBeCloseTo(80, 10);
  });

  it("is decided by ratio, not by volume", () => {
    const small = row("STATEN ISLAND", computed(2, 6));
    const large = row("BROOKLYN", computed(200, 360));

    expect(largestRise([small, large])).toMatchObject({ borough: "STATEN ISLAND" });
  });

  it("reports a tie rather than picking one", () => {
    const result = largestRise([row("BRONX", computed(10, 15)), row("QUEENS", computed(20, 30))]);

    expect(result.kind).toBe("tie");
    if (result.kind !== "tie") return;
    expect(result.boroughs.map((entry) => entry.borough).sort()).toEqual(["BRONX", "QUEENS"]);
  });

  it("reports none when nothing rose", () => {
    expect(
      largestRise([row("BRONX", computed(10, 8)), row("QUEENS", { kind: "no-data" })]),
    ).toEqual({ kind: "none" });
  });

  it("reports none for an empty set", () => {
    expect(largestRise([])).toEqual({ kind: "none" });
  });

  it("ignores boroughs that cannot be indexed", () => {
    const result = largestRise([
      row("BRONX", computed(10, 12)),
      row("QUEENS", { kind: "zero-baseline", weekendAverage: 900 }),
    ]);

    expect(result).toMatchObject({ borough: "BRONX" });
  });
});

describe("patternBreadth", () => {
  it("says all when every comparable borough rose", () => {
    expect(
      patternBreadth([row("BRONX", computed(10, 12)), row("QUEENS", computed(10, 14))]),
    ).toEqual({ kind: "all", total: 2 });
  });

  it("says none when no comparable borough rose", () => {
    expect(
      patternBreadth([row("BRONX", computed(10, 9)), row("QUEENS", computed(10, 8))]),
    ).toEqual({ kind: "none", total: 2 });
  });

  it("distinguishes most from some", () => {
    const most = patternBreadth([
      row("BRONX", computed(10, 12)),
      row("QUEENS", computed(10, 12)),
      row("MANHATTAN", computed(10, 8)),
    ]);
    const some = patternBreadth([
      row("BRONX", computed(10, 12)),
      row("QUEENS", computed(10, 8)),
      row("MANHATTAN", computed(10, 8)),
    ]);

    expect(most).toEqual({ kind: "most", higher: 2, total: 3 });
    expect(some).toEqual({ kind: "some", higher: 1, total: 3 });
  });

  it("refuses to characterise fewer than two comparable boroughs", () => {
    expect(patternBreadth([row("BRONX", computed(10, 12))])).toEqual({ kind: "insufficient" });
    expect(patternBreadth([row("BRONX", { kind: "no-data" })])).toEqual({ kind: "insufficient" });
  });

  it("counts only boroughs that could be compared", () => {
    expect(
      patternBreadth([
        row("BRONX", computed(10, 12)),
        row("QUEENS", computed(10, 12)),
        row("MANHATTAN", { kind: "no-data" }),
      ]),
    ).toEqual({ kind: "all", total: 2 });
  });
});

describe("buildBoroughRow", () => {
  const range = rollingRange(new Date(Date.UTC(2026, 7, 12)));

  it("carries the real figures alongside the index", () => {
    const summary = summarize(range, [{ day: `${range.start}T00:00:00.000`, complaints: "10" }], "BRONX");
    const built = buildBoroughRow(summary);

    expect(built.borough).toBe("BRONX");
    expect(built.weekdayDays).toBe(260);
    expect(built.weekendDays).toBe(104);
    expect(built.totalComplaints).toBe(10);
  });

  it("passes a malformed response through as no-data rather than zero", () => {
    const summary = summarize(range, [{ day: null, complaints: "" }], "QUEENS");
    const built = buildBoroughRow(summary);

    expect(summary.rejectedRows).toBeGreaterThan(0);
    expect(built.index).toEqual({ kind: "no-data" });
    expect(built.comparison).toEqual({ kind: "no-data" });
  });
});
