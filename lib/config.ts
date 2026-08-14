import { formatDaySpan } from "./format";
import { DAY_MS, isoDayUtc, previousSunday, shiftDays, utcDayFromIso, utcDayStart } from "./dates";

export const DATASET_URL = "https://data.cityofnewyork.us/resource/erm2-nwe9.json";

export const COMPLAINT_TYPE = "Noise - Residential";

export const BOROUGHS = [
  { label: "Brooklyn", value: "BROOKLYN" },
  { label: "Manhattan", value: "MANHATTAN" },
  { label: "Queens", value: "QUEENS" },
  { label: "Bronx", value: "BRONX" },
  { label: "Staten Island", value: "STATEN ISLAND" },
] as const;

export type Borough = (typeof BOROUGHS)[number]["value"];

export const DEFAULT_BOROUGH: Borough = "BROOKLYN";

/**
 * The order the citywide comparison is drawn in: alphabetical, and fixed.
 *
 * Deliberately not the order of `BOROUGHS` above, which leads with Brooklyn
 * because Brooklyn is the case study. A chart of five boroughs must not be
 * ordered by its own result - sorting by outcome turns a set of within-borough
 * comparisons into a league table, which is the reading this piece exists to
 * refuse. Alphabetical is arbitrary with respect to the data, which is the point.
 */
export const CITYWIDE_BOROUGH_ORDER: readonly Borough[] = [
  "BRONX",
  "BROOKLYN",
  "MANHATTAN",
  "QUEENS",
  "STATEN ISLAND",
];

export type RangeId = "primary" | "stress" | "current";

export type Range = {
  id: RangeId;
  label: string;
  /** Inclusive, YYYY-MM-DD. */
  start: string;
  /** Exclusive, YYYY-MM-DD. */
  endExclusive: string;
  /**
   * Human-readable inclusive span, shown to the reader.
   *
   * Written the way a person writes a date, not the way the query does. This
   * string reaches the reader in figure captions, key-figure captions, chart
   * accessible names and the table twins, so an ISO span here put
   * "across 2024-01-01 through 2024-12-29" in the middle of the prose. The exact
   * half-open boundaries the queries use are in `start` and `endExclusive` above,
   * and METHOD.md prints them.
   */
  display: string;
};

/**
 * Both ranges are 52 complete Monday-Sunday weeks: 260 weekdays and 104 weekend
 * days. `analysis.test.ts` asserts this rather than trusting the comment.
 */
export const RANGES: readonly [Range, Range] = [
  {
    id: "primary",
    label: "Primary range",
    start: "2024-01-01",
    endExclusive: "2024-12-30",
    display: "1 January to 29 December 2024",
  },
  {
    id: "stress",
    label: "Stress-test range",
    start: "2025-01-06",
    endExclusive: "2026-01-05",
    display: "6 January 2025 to 4 January 2026",
  },
];

export const PRIMARY_RANGE = RANGES[0];
export const STRESS_RANGE = RANGES[1];

/** 52 complete Monday-Sunday weeks: 364 days, 260 weekdays, 104 weekend days. */
export const RANGE_WEEKS = 52;
export const RANGE_DAYS = RANGE_WEEKS * 7;

/**
 * How many of the newest days are deliberately left out of the current period.
 *
 * 311 is republished daily and the most recent records are the least settled:
 * requests are still being entered and amended. This is a conservative allowance
 * for late additions and revisions, not a claim that a week is enough to
 * eliminate them - this repository holds no measurement of how far back 311
 * revisions actually reach, so no such claim is made. Because the period is then
 * snapped back to a completed Sunday, the newest day it contains is between 7 and
 * 13 days old.
 */
export const CURRENT_RANGE_BUFFER_DAYS = 7;

/**
 * The latest 52 complete Monday-Sunday weeks, as of an instant.
 *
 * A pure function of its argument, so the period is deterministic and testable
 * and there is exactly one place the current period is decided. Callers pass the
 * instant; nothing in here reads the clock. `loadPageData` passes the same
 * instant it stamps as the refresh time, so the period on the page and the time
 * beneath it can never disagree.
 *
 * The whole calculation is in UTC days. The buffer subtraction and the snap to
 * Sunday are both week-scale, so no host timezone can move the result: an offset
 * of hours cannot change which completed Sunday is most recent.
 *
 * Snapping to a Sunday is what guarantees the shape - 364 days from a Monday to a
 * Sunday is 52 whole weeks, so the weekday and weekend denominators are exactly
 * 260 and 104 without counting a single row.
 */
export function rollingRange(
  asOf: Date,
  bufferDays: number = CURRENT_RANGE_BUFFER_DAYS,
): Range {
  const cutoff = shiftDays(utcDayStart(asOf), -bufferDays);
  const endInclusive = previousSunday(cutoff);
  const start = shiftDays(endInclusive, -(RANGE_DAYS - 1));

  const startIso = isoDayUtc(start);
  const endInclusiveIso = isoDayUtc(endInclusive);

  return {
    id: "current",
    label: "Current period",
    start: startIso,
    endExclusive: isoDayUtc(endInclusive + DAY_MS),
    display: formatDaySpan(startIso, endInclusiveIso),
  };
}

/** The last day inside a range, which is the day before its exclusive end. */
export function lastDayOf(range: Range): string {
  return isoDayUtc(shiftDays(utcDayFromIso(range.endExclusive), -1));
}

export function isBorough(value: string): value is Borough {
  return BOROUGHS.some((borough) => borough.value === value);
}

export function normalizeBorough(value: string | null | undefined): Borough {
  return typeof value === "string" && isBorough(value) ? value : DEFAULT_BOROUGH;
}

export function boroughLabel(value: string | null | undefined): string {
  const normalized = normalizeBorough(value);
  return BOROUGHS.find((borough) => borough.value === normalized)!.label;
}

/**
 * Community-board normalization exists only for Brooklyn (SPEC.md "Current
 * Limitations"), so the board comparison is Brooklyn-only by product rule.
 */
export function showsBrooklynDeepDive(borough: string | null | undefined): boolean {
  return normalizeBorough(borough) === DEFAULT_BOROUGH;
}
