/**
 * The audited analysis, ported from `legacy/app.js`.
 *
 * Four properties are load-bearing and must survive any future edit:
 *
 *   1. Every date is parsed from components into UTC. `new Date(someString)` is
 *      never called, so nothing is reinterpreted through the host timezone.
 *   2. Hour-of-day is never derived here. Socrata's `date_extract_hh` computes it
 *      from `created_date`, which is NYC wall-clock time, and this module only
 *      validates the integer that comes back.
 *   3. Denominators come from walking the calendar, not from counting returned
 *      rows, so days with genuinely zero complaints stay in the denominator.
 *   4. Row validation rejects and counts. It never coerces.
 *
 * The row-validation predicates below are a verbatim port, including two checks
 * that cannot fire (`!row`, and the NaN test after `isValidDay` has passed). They
 * are retained so this port is provably behaviour-preserving; tightening them is
 * a separate change with its own diff.
 */

import {
  DEFAULT_BOROUGH,
  type Borough,
  type Range,
} from "./config";
import { PHASE3_BOARD_DATASET, type BoardDataset, type BoardRow } from "./static-data";

/** A row as it arrives from Socrata: shape unverified until it is validated. */
export type MaybeRow = Record<string, unknown> | null | undefined;

// ---------------------------------------------------------------------------
// Dates. UTC only, parsed from components.
// ---------------------------------------------------------------------------

export function utcDateFromDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date));
}

export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Mutating step, used by the ported calendar walks. */
export function addUtcDay(date: Date): void {
  date.setUTCDate(date.getUTCDate() + 1);
}

function nextUtcDay(date: Date): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

function previousUtcDay(date: Date): Date {
  const previous = new Date(date.getTime());
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous;
}

export function isValidDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return false;
  }

  return isoDay(utcDateFromDay(day)) === day;
}

export function isWeekendDay(day: string | Date): boolean {
  const date = typeof day === "string" ? utcDateFromDay(day) : day;
  return date.getUTCDay() === 0 || date.getUTCDay() === 6;
}

// ---------------------------------------------------------------------------
// Row validation. Rejects and counts; never coerces.
// ---------------------------------------------------------------------------

export type NormalizedDaily = {
  countsByDay: Map<string, number>;
  rejectedRows: number;
};

export function normalizeDailyRows(
  dailyRows: readonly MaybeRow[],
  range: Range,
): NormalizedDaily {
  const countsByDay = new Map<string, number>();
  const start = utcDateFromDay(range.start);
  const end = utcDateFromDay(range.endExclusive);
  let rejectedRows = 0;

  for (const row of dailyRows) {
    const dayValue = row?.day;
    const complaintValue = row?.complaints;
    const day = typeof dayValue === "string" ? dayValue.slice(0, 10) : "";
    const date = day ? utcDateFromDay(day) : new Date(Number.NaN);
    const complaints = Number(complaintValue);

    if (
      !row ||
      !isValidDay(day) ||
      Number.isNaN(date.getTime()) ||
      date < start ||
      date >= end ||
      complaintValue === undefined ||
      complaintValue === null ||
      complaintValue === "" ||
      !Number.isInteger(complaints) ||
      complaints < 0
    ) {
      rejectedRows += 1;
      continue;
    }

    countsByDay.set(day, (countsByDay.get(day) ?? 0) + complaints);
  }

  return { countsByDay, rejectedRows };
}

export type NormalizedHourly = {
  countsByDayHour: Map<string, number>;
  rejectedRows: number;
};

export function normalizeHourlyRows(
  hourlyRows: readonly MaybeRow[],
  range: Range,
): NormalizedHourly {
  const countsByDayHour = new Map<string, number>();
  const start = utcDateFromDay(range.start);
  const end = utcDateFromDay(range.endExclusive);
  let rejectedRows = 0;

  for (const row of hourlyRows) {
    const dayValue = row?.day;
    const hourValue = row?.hour;
    const complaintValue = row?.complaints;
    const day = typeof dayValue === "string" ? dayValue.slice(0, 10) : "";
    const date = day ? utcDateFromDay(day) : new Date(Number.NaN);
    const hour = Number(hourValue);
    const complaints = Number(complaintValue);

    if (
      !row ||
      !isValidDay(day) ||
      Number.isNaN(date.getTime()) ||
      date < start ||
      date >= end ||
      hourValue === undefined ||
      hourValue === null ||
      hourValue === "" ||
      !Number.isInteger(hour) ||
      hour < 0 ||
      hour > 23 ||
      complaintValue === undefined ||
      complaintValue === null ||
      complaintValue === "" ||
      !Number.isInteger(complaints) ||
      complaints < 0
    ) {
      rejectedRows += 1;
      continue;
    }

    countsByDayHour.set(
      `${day}|${hour}`,
      (countsByDayHour.get(`${day}|${hour}`) ?? 0) + complaints,
    );
  }

  return { countsByDayHour, rejectedRows };
}

// ---------------------------------------------------------------------------
// Weekday vs weekend.
// ---------------------------------------------------------------------------

/**
 * An absent comparison is a variant, not a null. Consumers must switch on `kind`,
 * so the defect recorded as REVIEW.md B1 - formatting a missing difference as
 * "0.0% higher" - cannot be written without a compile error.
 */
export type Comparison =
  | {
      kind: "computed";
      weekdayAverage: number;
      weekendAverage: number;
      percentageDifference: number;
      direction: "higher" | "lower" | "level";
    }
  | { kind: "zero-baseline"; weekendAverage: number }
  | { kind: "no-data" };

export type DaySummary = {
  range: Range;
  borough: Borough;
  weekdayDays: number;
  weekendDays: number;
  weekdayTotal: number;
  weekendTotal: number;
  totalComplaints: number;
  comparison: Comparison;
  rejectedRows: number;
  zeroDaysFilled: number;
};

function buildComparison(
  weekdayTotal: number,
  weekendTotal: number,
  weekdayDays: number,
  weekendDays: number,
): Comparison {
  // A range with no days of one type cannot produce a comparison. The original
  // divided by zero here and returned NaN.
  if (weekdayDays === 0 || weekendDays === 0) {
    return { kind: "no-data" };
  }

  if (weekdayTotal + weekendTotal === 0) {
    return { kind: "no-data" };
  }

  const weekdayAverage = weekdayTotal / weekdayDays;
  const weekendAverage = weekendTotal / weekendDays;

  if (weekdayAverage === 0) {
    return { kind: "zero-baseline", weekendAverage };
  }

  const percentageDifference = ((weekendAverage - weekdayAverage) / weekdayAverage) * 100;

  return {
    kind: "computed",
    weekdayAverage,
    weekendAverage,
    percentageDifference,
    direction:
      weekendAverage > weekdayAverage
        ? "higher"
        : weekendAverage < weekdayAverage
          ? "lower"
          : "level",
  };
}

export function summarize(
  range: Range,
  dailyRows: readonly MaybeRow[],
  borough: Borough = DEFAULT_BOROUGH,
): DaySummary {
  const { countsByDay, rejectedRows } = normalizeDailyRows(dailyRows, range);

  let weekdayDays = 0;
  let weekendDays = 0;
  let weekdayTotal = 0;
  let weekendTotal = 0;
  let zeroDaysFilled = 0;

  for (
    const date = utcDateFromDay(range.start), end = utcDateFromDay(range.endExclusive);
    date < end;
    addUtcDay(date)
  ) {
    const day = isoDay(date);
    const complaints = countsByDay.get(day) ?? 0;

    if (!countsByDay.has(day)) {
      zeroDaysFilled += 1;
    }

    if (isWeekendDay(date)) {
      weekendDays += 1;
      weekendTotal += complaints;
    } else {
      weekdayDays += 1;
      weekdayTotal += complaints;
    }
  }

  return {
    range,
    borough,
    weekdayDays,
    weekendDays,
    weekdayTotal,
    weekendTotal,
    totalComplaints: weekdayTotal + weekendTotal,
    comparison: buildComparison(weekdayTotal, weekendTotal, weekdayDays, weekendDays),
    rejectedRows,
    zeroDaysFilled,
  };
}

// ---------------------------------------------------------------------------
// Hour of day.
// ---------------------------------------------------------------------------

export type HourRow = {
  hour: number;
  weekdayTotal: number;
  weekendTotal: number;
  weekdayAverage: number;
  weekendAverage: number;
};

export type HourlySummary = {
  range: Range;
  borough: Borough;
  hours: HourRow[];
  weekdayDays: number;
  weekendDays: number;
  totalComplaints: number;
  hasData: boolean;
  rejectedRows: number;
  zeroCellsFilled: number;
};

export function summarizeHourly(
  range: Range,
  hourlyRows: readonly MaybeRow[],
  borough: Borough = DEFAULT_BOROUGH,
): HourlySummary {
  const { countsByDayHour, rejectedRows } = normalizeHourlyRows(hourlyRows, range);
  const hours: HourRow[] = Array.from({ length: 24 }, (_unused, hour) => ({
    hour,
    weekdayTotal: 0,
    weekendTotal: 0,
    weekdayAverage: 0,
    weekendAverage: 0,
  }));
  let weekdayDays = 0;
  let weekendDays = 0;
  let zeroCellsFilled = 0;

  for (
    const date = utcDateFromDay(range.start), end = utcDateFromDay(range.endExclusive);
    date < end;
    addUtcDay(date)
  ) {
    const day = isoDay(date);
    const weekend = isWeekendDay(date);

    if (weekend) {
      weekendDays += 1;
    } else {
      weekdayDays += 1;
    }

    // 24 hours are assumed for every day. On the two DST transition days the
    // wall clock disagrees: 2024-03-10 has no 02:00 hour and 2024-11-03 has two
    // 01:00 hours. Both fall on a Sunday and the effect is roughly 1% on those
    // two buckets. Documented in the Method section rather than silently patched.
    for (let hour = 0; hour < 24; hour += 1) {
      const key = `${day}|${hour}`;
      const complaints = countsByDayHour.get(key) ?? 0;

      if (!countsByDayHour.has(key)) {
        zeroCellsFilled += 1;
      }

      if (weekend) {
        hours[hour].weekendTotal += complaints;
      } else {
        hours[hour].weekdayTotal += complaints;
      }
    }
  }

  let totalComplaints = 0;

  for (const row of hours) {
    row.weekdayAverage = weekdayDays === 0 ? 0 : row.weekdayTotal / weekdayDays;
    row.weekendAverage = weekendDays === 0 ? 0 : row.weekendTotal / weekendDays;
    totalComplaints += row.weekdayTotal + row.weekendTotal;
  }

  return {
    range,
    borough,
    hours,
    weekdayDays,
    weekendDays,
    totalComplaints,
    hasData: totalComplaints > 0,
    rejectedRows,
    zeroCellsFilled,
  };
}

export type HourlyGap =
  | { kind: "gap"; hour: number; gap: number; weekdayAverage: number; weekendAverage: number }
  | { kind: "none" };

/**
 * The widest hour at which weekend days exceed weekday days. Returns `none` when
 * no hour has a positive excess, so no caller can describe a zero or negative
 * gap as a peak.
 */
export function largestHourlyGap(hourlySummary: HourlySummary): HourlyGap {
  let best: HourlyGap = { kind: "none" };

  for (const row of hourlySummary.hours) {
    const gap = row.weekendAverage - row.weekdayAverage;

    if (gap > 0 && (best.kind === "none" || gap > best.gap)) {
      best = {
        kind: "gap",
        hour: row.hour,
        gap,
        weekdayAverage: row.weekdayAverage,
        weekendAverage: row.weekendAverage,
      };
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Nights. New analysis: the behavioural evening.
// ---------------------------------------------------------------------------

/** A night runs from 22:00 to 03:59 the following morning. */
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 4;

export function isNightHour(hour: number): boolean {
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

/**
 * The day a night is anchored to. Complaints between 00:00 and 03:59 belong to
 * the night that began the previous evening. Returns null outside night hours.
 */
export function nightOf(day: string, hour: number): string | null {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !isNightHour(hour)) {
    return null;
  }

  if (hour >= NIGHT_START_HOUR) {
    return day;
  }

  return isoDay(previousUtcDay(utcDateFromDay(day)));
}

export const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** Monday-first index, so a Monday-Sunday range reads in order. */
function mondayIndex(utcDay: number): number {
  return (utcDay + 6) % 7;
}

export type NightRow = {
  weekday: string;
  nightsCounted: number;
  total: number;
  average: number;
};

export type NightSummary = {
  range: Range;
  borough: Borough;
  nights: NightRow[];
  totalComplaints: number;
  hasData: boolean;
  rejectedRows: number;
  /**
   * Anchors excluded because only half the night falls inside the range. Both
   * configured ranges run Monday-Sunday, so both dropped nights are Sunday
   * nights and Saturday keeps a full 52. Surfaced so the Method section can
   * state the denominators instead of implying a uniform 52.
   */
  droppedNights: string[];
};

export function summarizeNights(
  range: Range,
  hourlyRows: readonly MaybeRow[],
  borough: Borough = DEFAULT_BOROUGH,
): NightSummary {
  const { countsByDayHour, rejectedRows } = normalizeHourlyRows(hourlyRows, range);
  const nightsCounted = new Array<number>(7).fill(0);
  const totals = new Array<number>(7).fill(0);
  const completeNights = new Set<string>();
  const droppedNights: string[] = [];

  // The night anchored the day before the range always loses its evening half.
  droppedNights.push(isoDay(previousUtcDay(utcDateFromDay(range.start))));

  // Denominators come from the calendar, exactly as the daily and hourly
  // summaries do. A night counts only when both of its halves are in range.
  for (
    const date = utcDateFromDay(range.start), end = utcDateFromDay(range.endExclusive);
    date < end;
    addUtcDay(date)
  ) {
    const anchor = isoDay(date);
    const morning = isoDay(nextUtcDay(date));

    if (morning >= range.endExclusive) {
      droppedNights.push(anchor);
      continue;
    }

    completeNights.add(anchor);
    nightsCounted[mondayIndex(date.getUTCDay())] += 1;
  }

  for (const [key, complaints] of countsByDayHour) {
    const separator = key.indexOf("|");
    const day = key.slice(0, separator);
    const anchor = nightOf(day, Number(key.slice(separator + 1)));

    if (anchor === null || !completeNights.has(anchor)) {
      continue;
    }

    totals[mondayIndex(utcDateFromDay(anchor).getUTCDay())] += complaints;
  }

  const nights: NightRow[] = WEEKDAY_LABELS.map((weekday, index) => ({
    weekday,
    nightsCounted: nightsCounted[index],
    total: totals[index],
    average: nightsCounted[index] === 0 ? 0 : totals[index] / nightsCounted[index],
  }));

  const totalComplaints = totals.reduce((sum, value) => sum + value, 0);

  return {
    range,
    borough,
    nights,
    totalComplaints,
    hasData: totalComplaints > 0,
    rejectedRows,
    droppedNights,
  };
}

export type PeakNight = { kind: "peak"; night: NightRow } | { kind: "none" };

export function peakNight(summary: NightSummary): PeakNight {
  let best: PeakNight = { kind: "none" };

  for (const night of summary.nights) {
    if (night.nightsCounted > 0 && night.average > 0) {
      if (best.kind === "none" || night.average > best.night.average) {
        best = { kind: "peak", night };
      }
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Brooklyn community boards.
// ---------------------------------------------------------------------------

export type BoardRate = BoardRow & { complaintsPer1000Households: number };

export function buildBoardRates(dataset: BoardDataset = PHASE3_BOARD_DATASET): BoardRate[] {
  const boards = new Set<string>();

  for (const row of dataset.rows) {
    if (
      !/^BK(0[1-9]|1[0-8])$/.test(row.board) ||
      boards.has(row.board) ||
      !Number.isFinite(row.occupiedHouseholds) ||
      row.occupiedHouseholds <= 0 ||
      !Number.isInteger(row.saturdayNightComplaints) ||
      row.saturdayNightComplaints < 0
    ) {
      throw new Error("Invalid Phase 3 board provenance dataset");
    }

    boards.add(row.board);
  }

  if (boards.size !== 18 || dataset.rows.length !== 18) {
    throw new Error("Phase 3 board provenance dataset must contain 18 unique Brooklyn boards");
  }

  return dataset.rows
    .map((row) => ({
      ...row,
      complaintsPer1000Households: (row.saturdayNightComplaints / row.occupiedHouseholds) * 1000,
    }))
    .sort((a, b) => b.complaintsPer1000Households - a.complaintsPer1000Households);
}

/**
 * The share of Saturday-night complaints held by the `topN` highest-count boards.
 * The Phase 2 hypothesis pre-registered a 40% threshold for the top three.
 */
export function topBoardShare(
  topN: number,
  dataset: BoardDataset = PHASE3_BOARD_DATASET,
): { share: number; boards: string[]; total: number } {
  const sorted = [...dataset.rows].sort(
    (a, b) => b.saturdayNightComplaints - a.saturdayNightComplaints,
  );
  const total = sorted.reduce((sum, row) => sum + row.saturdayNightComplaints, 0);
  const top = sorted.slice(0, topN);
  const topTotal = top.reduce((sum, row) => sum + row.saturdayNightComplaints, 0);

  return {
    share: total === 0 ? 0 : (topTotal / total) * 100,
    boards: top.map((row) => row.board),
    total,
  };
}
