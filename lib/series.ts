/**
 * Per-day series for the corpus chart.
 *
 * This adds no query. It walks the same validated rows the weekday/weekend
 * summary already consumes, using the same exported primitives, and keeps them
 * in calendar order instead of collapsing them into two averages. `analysis.ts`
 * is untouched: the calendar walk here is the same shape as the one in
 * `summarize`, so a day with genuinely zero complaints still appears - as a
 * zero-height bar rather than a gap.
 */

import {
  addUtcDay,
  isWeekendDay,
  isoDay,
  normalizeDailyRows,
  utcDateFromDay,
  type MaybeRow,
} from "./analysis";
import type { Range } from "./config";

export type DayPoint = {
  /** YYYY-MM-DD. */
  day: string;
  complaints: number;
  weekend: boolean;
};

export type DailySeries = {
  range: Range;
  days: DayPoint[];
  hasData: boolean;
  min: DayPoint;
  max: DayPoint;
  /** Busiest day of each type, so the annotation can name both honestly. */
  maxWeekday: DayPoint;
  maxWeekend: DayPoint;
  median: number;
  weekdayMean: number;
  weekendMean: number;
  total: number;
  rejectedRows: number;
};

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export function weekdayName(day: string): string {
  return WEEKDAY_NAMES[utcDateFromDay(day).getUTCDay()];
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildDailySeries(range: Range, rows: readonly MaybeRow[]): DailySeries {
  const { countsByDay, rejectedRows } = normalizeDailyRows(rows, range);
  const days: DayPoint[] = [];

  for (
    const date = utcDateFromDay(range.start), end = utcDateFromDay(range.endExclusive);
    date < end;
    addUtcDay(date)
  ) {
    const day = isoDay(date);

    days.push({
      day,
      complaints: countsByDay.get(day) ?? 0,
      weekend: isWeekendDay(date),
    });
  }

  const counts = days.map((point) => point.complaints);
  const total = counts.reduce((sum, value) => sum + value, 0);

  // Ties resolve to the earliest day, so the choice is deterministic.
  let min = days[0];
  let max = days[0];
  let maxWeekday = days.find((point) => !point.weekend) ?? days[0];
  let maxWeekend = days.find((point) => point.weekend) ?? days[0];

  for (const point of days) {
    if (point.complaints < min.complaints) {
      min = point;
    }

    if (point.complaints > max.complaints) {
      max = point;
    }

    if (!point.weekend && point.complaints > maxWeekday.complaints) {
      maxWeekday = point;
    }

    if (point.weekend && point.complaints > maxWeekend.complaints) {
      maxWeekend = point;
    }
  }

  return {
    range,
    days,
    hasData: total > 0,
    min,
    max,
    maxWeekday,
    maxWeekend,
    median: median(counts),
    weekdayMean: mean(days.filter((point) => !point.weekend).map((point) => point.complaints)),
    weekendMean: mean(days.filter((point) => point.weekend).map((point) => point.complaints)),
    total,
    rejectedRows,
  };
}

export type Anchor = DayPoint & { label: string };

/**
 * Days worth naming on the chart. Candidates are built from the range's own year
 * and then filtered to those actually inside it - New Year's Eve falls outside
 * the primary range, which ends 2024-12-29, so it is dropped rather than
 * labelled onto a bar that is not there.
 *
 * The busiest day is always included, whatever it turns out to be. It is never
 * assumed to be a particular date.
 */
export function pickAnchors(series: DailySeries): Anchor[] {
  const year = series.range.start.slice(0, 4);
  const byDay = new Map(series.days.map((point) => [point.day, point]));

  const candidates: { day: string; label: string }[] = [
    { day: `${year}-01-01`, label: "New Year's Day" },
    { day: `${year}-03-12`, label: "An ordinary Tuesday in March" },
    { day: `${year}-07-04`, label: "Independence Day" },
    { day: `${year}-12-31`, label: "New Year's Eve" },
  ];

  const anchors: Anchor[] = [];
  const used = new Set<string>();

  for (const candidate of candidates) {
    const point = byDay.get(candidate.day);

    if (point && !used.has(point.day)) {
      anchors.push({ ...point, label: candidate.label });
      used.add(point.day);
    }
  }

  if (!used.has(series.max.day)) {
    anchors.push({ ...series.max, label: "Busiest day of the year" });
    used.add(series.max.day);
  }

  // The busiest weekday is the one worth naming for the argument: holidays that
  // behave like weekends still count in the weekday baseline.
  if (!used.has(series.maxWeekday.day)) {
    anchors.push({ ...series.maxWeekday, label: "Busiest weekday" });
    used.add(series.maxWeekday.day);
  }

  return anchors.sort((a, b) => a.day.localeCompare(b.day));
}
