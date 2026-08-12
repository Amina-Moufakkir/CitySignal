import { describe, expect, test } from "vitest";

import { PRIMARY_RANGE, type Range } from "./config";
import { summarize, type MaybeRow } from "./analysis";
import { buildDailySeries, pickAnchors, weekdayName } from "./series";

const WEEK: Range = {
  id: "primary",
  label: "Test week",
  start: "2024-01-01",
  endExclusive: "2024-01-08",
  display: "2024-01-01 through 2024-01-07",
};

function row(day: string, complaints: number): MaybeRow {
  return { day: `${day}T00:00:00.000`, complaints: String(complaints) };
}

describe("buildDailySeries", () => {
  test("emits one point per calendar day, including days with no complaints", () => {
    const series = buildDailySeries(WEEK, [row("2024-01-01", 10), row("2024-01-06", 4)]);

    expect(series.days).toHaveLength(7);
    expect(series.days.map((point) => point.day)).toEqual([
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
      "2024-01-04",
      "2024-01-05",
      "2024-01-06",
      "2024-01-07",
    ]);
    expect(series.days[1].complaints).toBe(0);
  });

  test("covers the full configured range", () => {
    const series = buildDailySeries(PRIMARY_RANGE, []);

    expect(series.days).toHaveLength(364);
    expect(series.days[0].day).toBe("2024-01-01");
    expect(series.days[363].day).toBe("2024-12-29");
  });

  test("classifies weekends the same way the summary does", () => {
    const series = buildDailySeries(PRIMARY_RANGE, []);

    expect(series.days.filter((point) => point.weekend)).toHaveLength(104);
    expect(series.days.filter((point) => !point.weekend)).toHaveLength(260);
  });

  // The corpus chart and the averaged chart must not be able to disagree.
  test("means match the summary computed from the same rows", () => {
    const rows = [
      row("2024-01-01", 10),
      row("2024-01-02", 20),
      row("2024-01-06", 40),
      row("2024-01-07", 60),
    ];
    const series = buildDailySeries(WEEK, rows);
    const summary = summarize(WEEK, rows);

    expect(summary.comparison.kind).toBe("computed");
    if (summary.comparison.kind !== "computed") return;

    expect(series.weekdayMean).toBeCloseTo(summary.comparison.weekdayAverage, 10);
    expect(series.weekendMean).toBeCloseTo(summary.comparison.weekendAverage, 10);
    expect(series.total).toBe(summary.totalComplaints);
    expect(series.rejectedRows).toBe(summary.rejectedRows);
  });

  test("reports min, max and median", () => {
    const series = buildDailySeries(WEEK, [
      row("2024-01-01", 5),
      row("2024-01-02", 100),
      row("2024-01-03", 7),
      row("2024-01-04", 9),
      row("2024-01-05", 11),
      row("2024-01-06", 13),
      row("2024-01-07", 15),
    ]);

    expect(series.max.day).toBe("2024-01-02");
    expect(series.max.complaints).toBe(100);
    expect(series.min.complaints).toBe(5);
    expect(series.median).toBe(11);
  });

  test("rejects malformed rows exactly as the summary does", () => {
    const rows: MaybeRow[] = [
      row("2024-01-01", 10),
      { day: "2024-01-02T00:00:00.000", complaints: null },
      { day: "not-a-date", complaints: "3" },
      null,
    ];

    expect(buildDailySeries(WEEK, rows).rejectedRows).toBe(3);
    expect(buildDailySeries(WEEK, rows).days[1].complaints).toBe(0);
  });

  test("an empty response yields a full calendar of zeroes, not an empty chart", () => {
    const series = buildDailySeries(WEEK, []);

    expect(series.days).toHaveLength(7);
    expect(series.hasData).toBe(false);
    expect(series.total).toBe(0);
  });
});

describe("pickAnchors", () => {
  test("drops candidates that fall outside the range rather than mislabelling a bar", () => {
    const series = buildDailySeries(PRIMARY_RANGE, []);
    const anchors = pickAnchors(series);
    const days = anchors.map((anchor) => anchor.day);

    // The primary range ends 2024-12-29, so New Year's Eve is not in it.
    expect(days).not.toContain("2024-12-31");
    expect(days).toContain("2024-01-01");
    expect(days).toContain("2024-07-04");
    expect(days).toContain("2024-03-12");

    for (const day of days) {
      expect(series.days.some((point) => point.day === day), day).toBe(true);
    }
  });

  test("always names the busiest day, whatever it is", () => {
    const series = buildDailySeries(PRIMARY_RANGE, [row("2024-09-14", 999)]);
    const anchors = pickAnchors(series);

    expect(anchors.some((anchor) => anchor.day === "2024-09-14")).toBe(true);
    expect(anchors.find((anchor) => anchor.day === "2024-09-14")?.label).toBe(
      "Busiest day of the year",
    );
  });

  test("does not label the same day twice when the busiest day is already a candidate", () => {
    const series = buildDailySeries(PRIMARY_RANGE, [row("2024-01-01", 999)]);
    const anchors = pickAnchors(series);
    const days = anchors.map((anchor) => anchor.day);

    expect(new Set(days).size).toBe(days.length);
    expect(anchors.find((anchor) => anchor.day === "2024-01-01")?.label).toBe("New Year's Day");
  });

  test("returns anchors in calendar order", () => {
    const anchors = pickAnchors(buildDailySeries(PRIMARY_RANGE, []));

    expect([...anchors].sort((a, b) => a.day.localeCompare(b.day))).toEqual(anchors);
  });
});

describe("weekdayName", () => {
  // The point of the annotation: the busiest day of 2024 sits in the weekday
  // baseline, which counts against the headline gap rather than for it.
  test("names the day of week in UTC", () => {
    expect(weekdayName("2024-01-01")).toBe("Monday");
    expect(weekdayName("2024-07-04")).toBe("Thursday");
    expect(weekdayName("2024-03-12")).toBe("Tuesday");
    expect(weekdayName("2024-12-29")).toBe("Sunday");
  });
});
