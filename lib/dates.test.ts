import { describe, expect, it } from "vitest";

import { DAY_MS, isoDayUtc, previousSunday, shiftDays, utcDayFromIso, utcDayStart } from "./dates";
import { addUtcDay, isoDay, utcDateFromDay } from "./analysis";

describe("UTC day primitives", () => {
  it("reads a day from an instant regardless of the time within it", () => {
    expect(isoDayUtc(Date.UTC(2026, 0, 5, 0, 0, 0))).toBe("2026-01-05");
    expect(isoDayUtc(Date.UTC(2026, 0, 5, 23, 59, 59))).toBe("2026-01-05");
  });

  it("pads months and days", () => {
    expect(isoDayUtc(Date.UTC(2026, 8, 9))).toBe("2026-09-09");
  });

  it("parses a day back to midnight UTC", () => {
    expect(utcDayFromIso("2026-09-09")).toBe(Date.UTC(2026, 8, 9));
  });

  it("rejects anything that is not a plain day", () => {
    expect(Number.isNaN(utcDayFromIso("2026-09-09T00:00:00"))).toBe(true);
    expect(Number.isNaN(utcDayFromIso("09/09/2026"))).toBe(true);
    expect(Number.isNaN(utcDayFromIso(""))).toBe(true);
  });

  it("drops the clock time from an instant", () => {
    expect(utcDayStart(Date.UTC(2026, 5, 1, 18, 30))).toBe(Date.UTC(2026, 5, 1));
  });

  it("crosses month and year boundaries", () => {
    expect(isoDayUtc(shiftDays(utcDayFromIso("2026-02-28"), 1))).toBe("2026-03-01");
    expect(isoDayUtc(shiftDays(utcDayFromIso("2025-12-31"), 1))).toBe("2026-01-01");
    expect(isoDayUtc(shiftDays(utcDayFromIso("2024-02-28"), 1))).toBe("2024-02-29");
  });

  it("snaps back to the previous Sunday", () => {
    // 2026-08-05 is a Wednesday; the Sunday before it is 2026-08-02.
    expect(isoDayUtc(previousSunday(utcDayFromIso("2026-08-05")))).toBe("2026-08-02");
  });

  it("leaves a Sunday where it is", () => {
    const sunday = utcDayFromIso("2026-08-02");

    expect(previousSunday(sunday)).toBe(sunday);
    expect(previousSunday(previousSunday(sunday))).toBe(sunday);
  });

  it("always lands on a Sunday, from any starting day", () => {
    for (let offset = 0; offset < 21; offset += 1) {
      const snapped = previousSunday(utcDayFromIso("2026-08-02") + offset * DAY_MS);

      expect(new Date(snapped).getUTCDay()).toBe(0);
    }
  });
});

/**
 * These primitives are duplicated from the audited analysis module rather than
 * shared with it, because `config` cannot import `analysis` without a cycle. The
 * duplication is only safe while the two agree, so that is asserted here across
 * several years rather than assumed.
 */
describe("agreement with the analysis module", () => {
  it("produces the same day strings across a multi-year sweep", () => {
    const cursor = utcDateFromDay("2023-11-15");

    for (let index = 0; index < 800; index += 1) {
      expect(isoDayUtc(cursor.getTime())).toBe(isoDay(cursor));
      addUtcDay(cursor);
    }
  });

  it("round-trips a day through both modules identically", () => {
    for (const day of ["2024-01-01", "2024-02-29", "2025-12-31", "2026-08-02"]) {
      expect(utcDayFromIso(day)).toBe(utcDateFromDay(day).getTime());
    }
  });
});
