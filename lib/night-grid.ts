/**
 * Every night of one weekday, hour by hour.
 *
 * The night-of-week chart answers "which night". This answers the question that
 * follows it and that an average cannot: is the pattern every week, or a handful
 * of big nights carrying the mean? Fifty-two rows settle it by showing all of
 * them rather than summarising them.
 *
 * No new query. It walks the same validated hourly rows the hour-of-day and
 * night-of-week summaries already consume, using only exported primitives, so
 * `analysis.ts` stays as ported.
 */

import {
  NIGHT_END_HOUR,
  NIGHT_START_HOUR,
  countCompleteNights,
  isoDay,
  normalizeHourlyRows,
  utcDateFromDay,
  type MaybeRow,
  type WeekdayLabel,
} from "./analysis";
import type { Range } from "./config";
import { weekdayName } from "./series";

/** Night order, not clock order: 22, 23, then 00 through 03. */
export const NIGHT_HOURS: readonly number[] = [
  ...Array.from({ length: 24 - NIGHT_START_HOUR }, (_unused, i) => NIGHT_START_HOUR + i),
  ...Array.from({ length: NIGHT_END_HOUR }, (_unused, i) => i),
];

export type NightRowDetail = {
  /** The evening the night began. */
  anchor: string;
  /** Counts in `NIGHT_HOURS` order. */
  hours: number[];
  total: number;
};

export type NightGrid = {
  range: Range;
  weekday: WeekdayLabel;
  nights: NightRowDetail[];
  /** Largest single hour in the grid, for the colour scale. */
  max: number;
  busiest: NightRowDetail;
  quietest: NightRowDetail;
  medianTotal: number;
  /** Nights whose total is at least half the busiest night's. */
  nightsAboveHalfPeak: number;
  rejectedRows: number;
};

function morningAfter(day: string): string {
  const date = utcDateFromDay(day);
  date.setUTCDate(date.getUTCDate() + 1);
  return isoDay(date);
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function buildNightGrid(
  range: Range,
  rows: readonly MaybeRow[],
  weekday: WeekdayLabel,
): NightGrid | null {
  const { countsByDayHour, rejectedRows } = normalizeHourlyRows(rows, range);
  const { anchors } = countCompleteNights(range);

  // Only complete nights of the requested weekday, in date order.
  const nights: NightRowDetail[] = [...anchors]
    .filter((anchor) => weekdayName(anchor) === weekday)
    .sort((a, b) => a.localeCompare(b))
    .map((anchor) => {
      const morning = morningAfter(anchor);
      const hours = NIGHT_HOURS.map((hour) => {
        const day = hour >= NIGHT_START_HOUR ? anchor : morning;
        return countsByDayHour.get(`${day}|${hour}`) ?? 0;
      });

      return { anchor, hours, total: hours.reduce((sum, value) => sum + value, 0) };
    });

  if (nights.length === 0) {
    return null;
  }

  let busiest = nights[0];
  let quietest = nights[0];
  let max = 0;

  for (const night of nights) {
    if (night.total > busiest.total) {
      busiest = night;
    }

    if (night.total < quietest.total) {
      quietest = night;
    }

    for (const value of night.hours) {
      if (value > max) {
        max = value;
      }
    }
  }

  const halfPeak = busiest.total / 2;

  return {
    range,
    weekday,
    nights,
    max,
    busiest,
    quietest,
    medianTotal: median(nights.map((night) => night.total)),
    nightsAboveHalfPeak: nights.filter((night) => night.total >= halfPeak).length,
    rejectedRows,
  };
}
