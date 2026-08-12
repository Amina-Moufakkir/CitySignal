import { describe, expect, test } from "vitest";

import { RANGES, type Range } from "./config";
import {
  buildBoardRates,
  isNightHour,
  isValidDay,
  isWeekendDay,
  largestHourlyGap,
  nightOf,
  normalizeDailyRows,
  normalizeHourlyRows,
  peakNight,
  summarize,
  summarizeHourly,
  summarizeNights,
  topBoardShare,
  utcDateFromDay,
  type MaybeRow,
} from "./analysis";
import { PHASE3_BOARD_DATASET } from "./static-data";

/** A one-week Monday-Sunday window, used by the ported tests. */
const WEEK: Range = {
  id: "primary",
  label: "Test week",
  start: "2024-01-01",
  endExclusive: "2024-01-08",
  display: "2024-01-01 through 2024-01-07",
};

function range(start: string, endExclusive: string): Range {
  return { id: "primary", label: "Test range", start, endExclusive, display: `${start}..` };
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

describe("date handling", () => {
  test("classifies weekdays and weekends by calendar day", () => {
    expect(isWeekendDay("2024-01-01")).toBe(false);
    expect(isWeekendDay("2024-01-05")).toBe(false);
    expect(isWeekendDay("2024-01-06")).toBe(true);
    expect(isWeekendDay("2024-01-07")).toBe(true);
  });

  test("parses days from components into UTC, never through the host timezone", () => {
    const date = utcDateFromDay("2024-03-10");

    expect(date.toISOString()).toBe("2024-03-10T00:00:00.000Z");
    expect(date.getUTCHours()).toBe(0);
  });

  test("rejects days that do not round-trip", () => {
    expect(isValidDay("2024-01-01")).toBe(true);
    expect(isValidDay("2024-02-29")).toBe(true);
    expect(isValidDay("2023-02-29")).toBe(false);
    expect(isValidDay("2024-13-40")).toBe(false);
    expect(isValidDay("not-a-date")).toBe(false);
    expect(isValidDay("")).toBe(false);
  });

  test("day classification is stable across DST transitions and year ends", () => {
    expect(isWeekendDay("2024-03-10")).toBe(true);
    expect(isWeekendDay("2024-11-03")).toBe(true);
    expect(isWeekendDay("2024-02-29")).toBe(false);
    expect(isWeekendDay("2024-12-31")).toBe(false);
    expect(isWeekendDay("2025-01-01")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Configured ranges
// ---------------------------------------------------------------------------

describe("configured ranges", () => {
  test("both ranges are 52 complete Monday-Sunday weeks", () => {
    for (const configured of RANGES) {
      const summary = summarize(configured, []);

      expect(summary.weekdayDays, configured.label).toBe(260);
      expect(summary.weekendDays, configured.label).toBe(104);
      expect(summary.weekdayDays + summary.weekendDays, configured.label).toBe(364);
    }
  });

  test("both ranges start on a Monday and end on a Sunday", () => {
    for (const configured of RANGES) {
      const start = utcDateFromDay(configured.start);
      const end = utcDateFromDay(configured.endExclusive);
      end.setUTCDate(end.getUTCDate() - 1);

      expect(start.getUTCDay(), configured.label).toBe(1);
      expect(end.getUTCDay(), configured.label).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Daily summary
// ---------------------------------------------------------------------------

describe("summarize", () => {
  test("fills missing calendar days with zero complaints", () => {
    const summary = summarize(WEEK, [
      { day: "2024-01-01T00:00:00.000", complaints: "10" },
      { day: "2024-01-06T00:00:00.000", complaints: "4" },
    ]);

    expect(summary.weekdayDays).toBe(5);
    expect(summary.weekendDays).toBe(2);
    expect(summary.zeroDaysFilled).toBe(5);
    expect(summary.weekdayTotal).toBe(10);
    expect(summary.weekendTotal).toBe(4);
  });

  test("calculates averages per observed calendar day", () => {
    const summary = summarize(WEEK, [
      { day: "2024-01-01T00:00:00.000", complaints: "10" },
      { day: "2024-01-02T00:00:00.000", complaints: "15" },
      { day: "2024-01-06T00:00:00.000", complaints: "8" },
      { day: "2024-01-07T00:00:00.000", complaints: "12" },
    ]);

    expect(summary.comparison.kind).toBe("computed");
    if (summary.comparison.kind !== "computed") return;
    expect(summary.comparison.weekdayAverage).toBe(5);
    expect(summary.comparison.weekendAverage).toBe(10);
  });

  test("calculates percentage difference from the weekday daily mean", () => {
    const summary = summarize(WEEK, [
      { day: "2024-01-01T00:00:00.000", complaints: "25" },
      { day: "2024-01-06T00:00:00.000", complaints: "20" },
      { day: "2024-01-07T00:00:00.000", complaints: "20" },
    ]);

    expect(summary.comparison.kind).toBe("computed");
    if (summary.comparison.kind !== "computed") return;
    expect(summary.comparison.weekdayAverage).toBe(5);
    expect(summary.comparison.weekendAverage).toBe(20);
    expect(summary.comparison.percentageDifference).toBe(300);
    expect(summary.comparison.direction).toBe("higher");
  });

  test("reports direction from the data, never a fixed assumption", () => {
    const higher = summarize(WEEK, [
      { day: "2024-01-01T00:00:00.000", complaints: "5" },
      { day: "2024-01-06T00:00:00.000", complaints: "20" },
    ]);
    const lower = summarize(WEEK, [
      { day: "2024-01-01T00:00:00.000", complaints: "50" },
      { day: "2024-01-06T00:00:00.000", complaints: "2" },
    ]);
    const level = summarize(WEEK, [
      { day: "2024-01-01T00:00:00.000", complaints: "10" },
      { day: "2024-01-06T00:00:00.000", complaints: "4" },
    ]);

    expect(higher.comparison.kind === "computed" && higher.comparison.direction).toBe("higher");
    expect(lower.comparison.kind === "computed" && lower.comparison.direction).toBe("lower");
    expect(level.comparison.kind === "computed" && level.comparison.direction).toBe("level");
  });

  // REVIEW.md B1: the original produced "0.0% higher" here.
  test("an empty response yields no-data, not a zero difference", () => {
    const summary = summarize(WEEK, []);

    expect(summary.comparison).toEqual({ kind: "no-data" });
    expect(summary.totalComplaints).toBe(0);
    expect(summary.weekdayTotal).toBe(0);
    expect(summary.weekendTotal).toBe(0);
    expect(summary.zeroDaysFilled).toBe(7);
  });

  test("a zero weekday baseline is its own variant, not a percentage", () => {
    const summary = summarize(WEEK, [{ day: "2024-01-06T00:00:00.000", complaints: "20" }]);

    expect(summary.comparison.kind).toBe("zero-baseline");
    if (summary.comparison.kind !== "zero-baseline") return;
    expect(summary.comparison.weekendAverage).toBe(10);
    expect(Object.keys(summary.comparison)).not.toContain("percentageDifference");
  });

  test("a range with no weekday days yields no-data rather than NaN", () => {
    const summary = summarize(range("2024-01-06", "2024-01-08"), [
      { day: "2024-01-06T00:00:00.000", complaints: "9" },
    ]);

    expect(summary.weekdayDays).toBe(0);
    expect(summary.comparison).toEqual({ kind: "no-data" });
  });

  test("counts the leap day once and crosses a year boundary cleanly", () => {
    const leap = summarize(range("2024-02-28", "2024-03-02"), [
      { day: "2024-02-29T00:00:00.000", complaints: "7" },
    ]);

    expect(leap.weekdayDays + leap.weekendDays).toBe(3);
    expect(leap.weekdayTotal).toBe(7);

    const boundary = summarize(range("2024-12-30", "2025-01-02"), [
      { day: "2024-12-31T00:00:00.000", complaints: "5" },
      { day: "2025-01-01T00:00:00.000", complaints: "9" },
    ]);

    expect(boundary.weekdayDays).toBe(3);
    expect(boundary.weekdayTotal).toBe(14);
    expect(boundary.zeroDaysFilled).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Row validation
// ---------------------------------------------------------------------------

describe("row validation", () => {
  test("rejects malformed aggregate rows and continues with valid rows", () => {
    const rows: MaybeRow[] = [
      { day: "2024-01-01T00:00:00.000", complaints: "10" },
      { complaints: "3" },
      { day: "not-a-date", complaints: "3" },
      { day: "2024-13-40T00:00:00.000", complaints: "3" },
      { day: "2024-01-02T00:00:00.000" },
      { day: "2024-01-03T00:00:00.000", complaints: "abc" },
      { day: "2024-01-04T00:00:00.000", complaints: "-1" },
      { day: "2024-01-09T00:00:00.000", complaints: "5" },
      null,
    ];

    const normalized = normalizeDailyRows(rows, WEEK);
    const summary = summarize(WEEK, rows);

    expect(normalized.rejectedRows).toBe(8);
    expect(summary.rejectedRows).toBe(8);
    expect(summary.weekdayTotal).toBe(10);
    expect(summary.weekendTotal).toBe(0);
  });

  // Number(null) === 0 and Number("") === 0 both pass Number.isInteger, so these
  // guards are load-bearing: without them, phantom zero-complaint days appear.
  test("rejects null and empty aggregate values rather than coercing them to zero", () => {
    const rows: MaybeRow[] = [
      { day: "2024-01-01T00:00:00.000", complaints: null },
      { day: "2024-01-02T00:00:00.000", complaints: "" },
      { day: "2024-01-03T00:00:00.000", complaints: undefined },
    ];

    const normalized = normalizeDailyRows(rows, WEEK);

    expect(normalized.rejectedRows).toBe(3);
    expect(normalized.countsByDay.size).toBe(0);
  });

  test("rejects null and empty hourly values", () => {
    const rows: MaybeRow[] = [
      { day: "2024-01-01T00:00:00.000", hour: null, complaints: "5" },
      { day: "2024-01-01T00:00:00.000", hour: "", complaints: "5" },
      { day: "2024-01-01T00:00:00.000", hour: "1", complaints: null },
      { day: "2024-01-01T00:00:00.000", hour: "1", complaints: "" },
    ];

    expect(normalizeHourlyRows(rows, WEEK).rejectedRows).toBe(4);
  });

  test("rejects malformed hourly aggregate rows", () => {
    const rows: MaybeRow[] = [
      { day: "2024-01-01T00:00:00.000", hour: "0", complaints: "10" },
      { day: "2024-01-01T00:00:00.000", hour: "24", complaints: "3" },
      { day: "2024-01-01T00:00:00.000", hour: "-1", complaints: "3" },
      { day: "2024-01-01T00:00:00.000", hour: "1.5", complaints: "3" },
      { day: "not-a-date", hour: "1", complaints: "3" },
      { day: "2024-01-01T00:00:00.000", complaints: "3" },
      { day: "2024-01-01T00:00:00.000", hour: "1", complaints: "abc" },
      { day: "2024-01-09T00:00:00.000", hour: "1", complaints: "3" },
      null,
    ];

    const normalized = normalizeHourlyRows(rows, WEEK);
    const summary = summarizeHourly(WEEK, rows);

    expect(normalized.rejectedRows).toBe(8);
    expect(summary.rejectedRows).toBe(8);
    expect(summary.hours[0].weekdayTotal).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Hourly summary
// ---------------------------------------------------------------------------

describe("summarizeHourly", () => {
  test("classifies days locally and fills missing day-hour cells", () => {
    const summary = summarizeHourly(WEEK, [
      { day: "2024-01-01T00:00:00.000", hour: "0", complaints: "10" },
      { day: "2024-01-06T00:00:00.000", hour: "0", complaints: "8" },
      { day: "2024-01-07T00:00:00.000", hour: "0", complaints: "12" },
      { day: "2024-01-06T00:00:00.000", hour: "23", complaints: "4" },
    ]);

    expect(summary.weekdayDays).toBe(5);
    expect(summary.weekendDays).toBe(2);
    expect(summary.zeroCellsFilled).toBe(7 * 24 - 4);
    expect(summary.hours[0].weekdayAverage).toBe(2);
    expect(summary.hours[0].weekendAverage).toBe(10);
    expect(summary.hours[23].weekdayAverage).toBe(0);
    expect(summary.hours[23].weekendAverage).toBe(2);
  });

  // created_date is NYC wall-clock time, so the two DST transition days are not
  // 24 hours long. The grid assumes 24 regardless. Documented, not corrected.
  test("assumes a 24-hour grid on the spring-forward day, which has no 02:00", () => {
    const week = range("2024-03-04", "2024-03-11");
    const summary = summarizeHourly(week, [
      { day: "2024-03-10T00:00:00.000", hour: "1", complaints: "12" },
      { day: "2024-03-10T00:00:00.000", hour: "3", complaints: "6" },
    ]);

    expect(summary.weekdayDays).toBe(5);
    expect(summary.weekendDays).toBe(2);
    expect(summary.hours).toHaveLength(24);
    // 02:00 never occurred on 2024-03-10 but still divides by both weekend days.
    expect(summary.hours[2].weekendTotal).toBe(0);
    expect(summary.hours[2].weekendAverage).toBe(0);
    expect(summary.hours[1].weekendAverage).toBe(6);
  });

  test("passes the fall-back day through unchanged, where 01:00 spans two real hours", () => {
    const week = range("2024-10-28", "2024-11-04");
    const summary = summarizeHourly(week, [
      { day: "2024-11-03T00:00:00.000", hour: "1", complaints: "40" },
    ]);

    expect(summary.weekendDays).toBe(2);
    // Socrata reports a single wall-clock hour 1; the two real hours inside it
    // are not separable from the aggregate and are not adjusted for.
    expect(summary.hours[1].weekendTotal).toBe(40);
    expect(summary.hours[1].weekendAverage).toBe(20);
  });

  test("an empty response yields no hours with data", () => {
    const summary = summarizeHourly(WEEK, []);

    expect(summary.hasData).toBe(false);
    expect(summary.totalComplaints).toBe(0);
    expect(summary.hours.every((row) => row.weekdayAverage === 0 && row.weekendAverage === 0)).toBe(
      true,
    );
  });
});

describe("largestHourlyGap", () => {
  test("finds the widest positive weekend excess", () => {
    const gap = largestHourlyGap({
      ...summarizeHourly(WEEK, []),
      hours: [
        { hour: 0, weekdayTotal: 0, weekendTotal: 0, weekdayAverage: 4, weekendAverage: 8 },
        { hour: 1, weekdayTotal: 0, weekendTotal: 0, weekdayAverage: 2, weekendAverage: 11 },
        { hour: 2, weekdayTotal: 0, weekendTotal: 0, weekdayAverage: 6, weekendAverage: 7 },
      ],
    });

    expect(gap).toEqual({
      kind: "gap",
      hour: 1,
      gap: 9,
      weekdayAverage: 2,
      weekendAverage: 11,
    });
  });

  // REVIEW.md B1: the original returned { hour: 0, gap: 0 } here, which the page
  // then described as the peak hour.
  test("returns none when no hour has a positive excess", () => {
    expect(largestHourlyGap(summarizeHourly(WEEK, []))).toEqual({ kind: "none" });

    const allLower = largestHourlyGap({
      ...summarizeHourly(WEEK, []),
      hours: [
        { hour: 0, weekdayTotal: 0, weekendTotal: 0, weekdayAverage: 9, weekendAverage: 4 },
        { hour: 1, weekdayTotal: 0, weekendTotal: 0, weekdayAverage: 3, weekendAverage: 3 },
      ],
    });

    expect(allLower).toEqual({ kind: "none" });
  });
});

// ---------------------------------------------------------------------------
// Nights
// ---------------------------------------------------------------------------

describe("nightOf", () => {
  test("anchors evening hours to the same day", () => {
    expect(nightOf("2024-01-06", 22)).toBe("2024-01-06");
    expect(nightOf("2024-01-06", 23)).toBe("2024-01-06");
  });

  test("anchors 00:00-03:59 to the previous evening", () => {
    expect(nightOf("2024-01-07", 0)).toBe("2024-01-06");
    expect(nightOf("2024-01-07", 3)).toBe("2024-01-06");
  });

  test("crosses month, year and leap boundaries", () => {
    expect(nightOf("2024-01-01", 1)).toBe("2023-12-31");
    expect(nightOf("2024-03-01", 2)).toBe("2024-02-29");
    expect(nightOf("2025-01-01", 0)).toBe("2024-12-31");
  });

  test("returns null outside night hours", () => {
    expect(nightOf("2024-01-06", 4)).toBeNull();
    expect(nightOf("2024-01-06", 12)).toBeNull();
    expect(nightOf("2024-01-06", 21)).toBeNull();
    expect(isNightHour(21)).toBe(false);
    expect(isNightHour(22)).toBe(true);
    expect(isNightHour(3)).toBe(true);
    expect(isNightHour(4)).toBe(false);
  });
});

describe("summarizeNights", () => {
  // Both configured ranges run Monday-Sunday. The night before the range and the
  // final night each lose half of themselves, and both are Sunday nights, so
  // Saturday keeps a full 52 while Sunday drops to 51.
  test("counts 52 complete nights for Monday-Saturday and 51 for Sunday", () => {
    for (const configured of RANGES) {
      const summary = summarizeNights(configured, []);
      const counted = Object.fromEntries(
        summary.nights.map((night) => [night.weekday, night.nightsCounted]),
      );

      expect(counted, configured.label).toEqual({
        Monday: 52,
        Tuesday: 52,
        Wednesday: 52,
        Thursday: 52,
        Friday: 52,
        Saturday: 52,
        Sunday: 51,
      });
      expect(summary.droppedNights, configured.label).toHaveLength(2);
    }
  });

  test("names the dropped nights so the Method section can state them", () => {
    const summary = summarizeNights(RANGES[0], []);

    expect(summary.droppedNights).toEqual(["2023-12-31", "2024-12-29"]);
    expect(summary.droppedNights.every((day) => isWeekendDay(day))).toBe(true);
  });

  test("attributes 00:00-03:59 complaints to the previous evening", () => {
    // 2024-01-06 is a Saturday. Its night is 22:00-23:59 on the 6th plus
    // 00:00-03:59 on the 7th.
    const summary = summarizeNights(WEEK, [
      { day: "2024-01-06T00:00:00.000", hour: "22", complaints: "10" },
      { day: "2024-01-06T00:00:00.000", hour: "23", complaints: "5" },
      { day: "2024-01-07T00:00:00.000", hour: "0", complaints: "20" },
      { day: "2024-01-07T00:00:00.000", hour: "3", complaints: "4" },
      // Not a night hour, must be ignored entirely.
      { day: "2024-01-06T00:00:00.000", hour: "14", complaints: "999" },
      // 04:00 is outside the night window.
      { day: "2024-01-07T00:00:00.000", hour: "4", complaints: "888" },
    ]);

    const saturday = summary.nights.find((night) => night.weekday === "Saturday")!;

    expect(saturday.total).toBe(39);
    expect(saturday.nightsCounted).toBe(1);
    expect(saturday.average).toBe(39);
    expect(summary.totalComplaints).toBe(39);
  });

  test("discards the leading partial night rather than crediting it", () => {
    // 00:00-03:59 on the first day of the range belongs to a night whose evening
    // is outside the range.
    const summary = summarizeNights(WEEK, [
      { day: "2024-01-01T00:00:00.000", hour: "1", complaints: "50" },
    ]);

    expect(summary.totalComplaints).toBe(0);
    expect(summary.hasData).toBe(false);
  });

  test("discards the trailing partial night rather than crediting it", () => {
    // 2024-01-07 is the last day of the week; its 22:00 hours have no morning.
    const summary = summarizeNights(WEEK, [
      { day: "2024-01-07T00:00:00.000", hour: "22", complaints: "50" },
    ]);

    expect(summary.totalComplaints).toBe(0);
    expect(summary.droppedNights).toContain("2024-01-07");
  });

  test("averages over complete nights only", () => {
    const summary = summarizeNights(range("2024-01-01", "2024-01-16"), [
      { day: "2024-01-06T00:00:00.000", hour: "22", complaints: "10" },
      { day: "2024-01-13T00:00:00.000", hour: "22", complaints: "30" },
    ]);

    const saturday = summary.nights.find((night) => night.weekday === "Saturday")!;

    expect(saturday.nightsCounted).toBe(2);
    expect(saturday.total).toBe(40);
    expect(saturday.average).toBe(20);
  });
});

describe("peakNight", () => {
  test("names the strongest night from the data", () => {
    const summary = summarizeNights(WEEK, [
      { day: "2024-01-05T00:00:00.000", hour: "22", complaints: "10" },
      { day: "2024-01-06T00:00:00.000", hour: "22", complaints: "30" },
    ]);

    const peak = peakNight(summary);

    expect(peak.kind).toBe("peak");
    if (peak.kind !== "peak") return;
    expect(peak.night.weekday).toBe("Saturday");
    expect(peak.night.average).toBe(30);
  });

  test("returns none when there is nothing to rank", () => {
    expect(peakNight(summarizeNights(WEEK, []))).toEqual({ kind: "none" });
  });
});

// ---------------------------------------------------------------------------
// Brooklyn boards
// ---------------------------------------------------------------------------

describe("buildBoardRates", () => {
  test("validates the provenance dataset and reproduces the normalized ranking", () => {
    const boardRates = buildBoardRates();

    expect(PHASE3_BOARD_DATASET.rows).toHaveLength(18);
    expect(new Set(PHASE3_BOARD_DATASET.rows.map((row) => row.board)).size).toBe(18);
    expect(boardRates.slice(0, 6).map((row) => row.board)).toEqual([
      "BK04",
      "BK05",
      "BK01",
      "BK03",
      "BK16",
      "BK17",
    ]);
    expect(Number(boardRates[0].complaintsPer1000Households.toFixed(3))).toBe(30.643);
  });

  test("rejects a malformed provenance dataset", () => {
    const rows = PHASE3_BOARD_DATASET.rows;

    expect(() =>
      buildBoardRates({
        ...PHASE3_BOARD_DATASET,
        rows: [...rows.slice(1), { board: "BK99", occupiedHouseholds: 1, saturdayNightComplaints: 1 }],
      }),
    ).toThrow(/Invalid Phase 3 board provenance dataset/);

    expect(() =>
      buildBoardRates({
        ...PHASE3_BOARD_DATASET,
        rows: rows.map((row, index) => (index === 0 ? { ...row, occupiedHouseholds: 0 } : row)),
      }),
    ).toThrow(/Invalid Phase 3 board provenance dataset/);

    expect(() =>
      buildBoardRates({
        ...PHASE3_BOARD_DATASET,
        rows: rows.map((row, index) =>
          index === 0 ? { ...row, saturdayNightComplaints: 1.5 } : row,
        ),
      }),
    ).toThrow(/Invalid Phase 3 board provenance dataset/);

    expect(() => buildBoardRates({ ...PHASE3_BOARD_DATASET, rows: rows.slice(0, 17) })).toThrow(
      /18 unique Brooklyn boards/,
    );
  });
});

describe("topBoardShare", () => {
  // README reports 38.0% against a pre-registered 40% threshold. Until now that
  // figure had no code behind it, though the committed dataset derives it exactly.
  test("reproduces the top-three concentration reported in the README", () => {
    const { share, boards, total } = topBoardShare(3);

    expect(total).toBe(9944);
    expect(boards).toEqual(["BK04", "BK01", "BK05"]);
    expect(Number(share.toFixed(1))).toBe(38.0);
    expect(share).toBeLessThan(40);
  });
});
