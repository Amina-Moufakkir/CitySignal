import { describe, expect, it } from "vitest";

import {
  CURRENT_RANGE_BUFFER_DAYS,
  RANGE_DAYS,
  RANGE_WEEKS,
  lastDayOf,
  rollingRange,
} from "./config";
import { summarize } from "./analysis";
import { DAY_MS, utcDayFromIso } from "./dates";

/** A fixed instant, so nothing here depends on when the suite runs. */
const AS_OF = new Date(Date.UTC(2026, 7, 12, 15, 30));

function dayOfWeek(iso: string): number {
  return new Date(utcDayFromIso(iso)).getUTCDay();
}

describe("rollingRange", () => {
  it("returns the documented period for a known instant", () => {
    const range = rollingRange(AS_OF);

    expect(range.start).toBe("2025-08-04");
    expect(range.endExclusive).toBe("2026-08-03");
    expect(lastDayOf(range)).toBe("2026-08-02");
    expect(range.id).toBe("current");
  });

  it("starts on a Monday and ends on a Sunday", () => {
    const range = rollingRange(AS_OF);

    expect(dayOfWeek(range.start)).toBe(1);
    expect(dayOfWeek(lastDayOf(range))).toBe(0);
  });

  it("spans exactly 52 whole weeks", () => {
    const range = rollingRange(AS_OF);
    const days = (utcDayFromIso(range.endExclusive) - utcDayFromIso(range.start)) / DAY_MS;

    expect(days).toBe(RANGE_DAYS);
    expect(days % 7).toBe(0);
    expect(days / 7).toBe(RANGE_WEEKS);
  });

  /**
   * The denominators come from walking the calendar, which is the same path the
   * analysis uses, so this asserts the property the whole range policy exists to
   * guarantee rather than restating the arithmetic above.
   */
  it("yields exactly 260 weekdays and 104 weekend days", () => {
    const summary = summarize(rollingRange(AS_OF), []);

    expect(summary.weekdayDays).toBe(260);
    expect(summary.weekendDays).toBe(104);
  });

  it("holds that shape for every possible as-of weekday", () => {
    for (let offset = 0; offset < 28; offset += 1) {
      const range = rollingRange(new Date(AS_OF.getTime() + offset * DAY_MS));
      const summary = summarize(range, []);

      expect(dayOfWeek(range.start)).toBe(1);
      expect(dayOfWeek(lastDayOf(range))).toBe(0);
      expect(summary.weekdayDays).toBe(260);
      expect(summary.weekendDays).toBe(104);
    }
  });

  it("excludes the newest days by the configured buffer", () => {
    const range = rollingRange(AS_OF);
    const ageDays = (utcDayFromIso("2026-08-12") - utcDayFromIso(lastDayOf(range))) / DAY_MS;

    expect(ageDays).toBeGreaterThanOrEqual(CURRENT_RANGE_BUFFER_DAYS);
    expect(ageDays).toBeLessThan(CURRENT_RANGE_BUFFER_DAYS + 7);
  });

  it("is deterministic: the same instant always gives the same period", () => {
    expect(rollingRange(AS_OF)).toEqual(rollingRange(new Date(AS_OF.getTime())));
  });

  it("ignores the time of day within an instant", () => {
    const midnight = new Date(Date.UTC(2026, 7, 12, 0, 0, 0));
    const almostMidnight = new Date(Date.UTC(2026, 7, 12, 23, 59, 59));

    expect(rollingRange(midnight)).toEqual(rollingRange(almostMidnight));
  });

  /**
   * The period must be a function of the instant alone. A `getDay()` where a
   * `getUTCDay()` belongs would make the window jump a week for readers on one
   * side of the date line; the CI timezone matrix runs this file under four
   * zones, and the epoch arithmetic here is identical in all of them.
   */
  it("depends only on the instant, not on how the Date was constructed", () => {
    const fromEpoch = new Date(AS_OF.getTime());
    const fromParts = new Date(Date.UTC(2026, 7, 12, 15, 30));

    expect(rollingRange(fromEpoch)).toEqual(rollingRange(fromParts));
  });

  it("advances one whole week at a time, never a partial one", () => {
    const seen = new Set<string>();

    for (let offset = 0; offset < 21; offset += 1) {
      seen.add(rollingRange(new Date(AS_OF.getTime() + offset * DAY_MS)).start);
    }

    const starts = [...seen].sort();

    for (let i = 1; i < starts.length; i += 1) {
      const gap = (utcDayFromIso(starts[i]) - utcDayFromIso(starts[i - 1])) / DAY_MS;
      expect(gap).toBe(7);
    }
  });

  it("moves the window when the buffer changes, keeping the shape", () => {
    const tight = rollingRange(AS_OF, 0);
    const loose = rollingRange(AS_OF, 14);

    expect(summarize(tight, []).weekdayDays).toBe(260);
    expect(summarize(loose, []).weekdayDays).toBe(260);
    expect(utcDayFromIso(loose.start)).toBeLessThan(utcDayFromIso(tight.start));
  });

  it("writes its dates for a reader", () => {
    expect(rollingRange(AS_OF).display).toBe("4 August 2025 to 2 August 2026");
  });
});
