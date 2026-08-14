/**
 * The five-borough comparison, indexed within each borough.
 *
 * Every borough is indexed against its own weekday baseline, which is the only
 * comparison this data supports. Raw daily counts across boroughs are not
 * comparable - Brooklyn holds several times the households of Staten Island - so
 * the chart deliberately throws the levels away and keeps the ratio.
 *
 * Absence stays a variant here, the same way it does in `analysis.ts`. A borough
 * with no weekday baseline cannot be indexed, and a borough with no data cannot
 * be compared; neither is allowed to become a zero or to quietly vanish from a
 * chart that claims to show five boroughs.
 */

import type { Comparison, DaySummary } from "./analysis";
import { boroughLabel, CITYWIDE_BOROUGH_ORDER, type Borough } from "./config";

/**
 * Every borough's weekday baseline is drawn at the same place. The index is the
 * chart's whole argument: it is what makes five different volumes comparable
 * without implying their volumes are.
 */
export const WEEKDAY_INDEX = 100;

export type BoroughIndex =
  | {
      kind: "computed";
      /** Always `WEEKDAY_INDEX`. Present so the chart never has to assume it. */
      weekdayIndex: number;
      weekendIndex: number;
      percentageDifference: number;
      direction: "higher" | "lower" | "level";
    }
  | { kind: "no-baseline" }
  | { kind: "no-data" };

export type BoroughRow = {
  borough: Borough;
  label: string;
  index: BoroughIndex;
  /** The real figures behind the index, for the table twin and the profile. */
  comparison: Comparison;
  weekdayDays: number;
  weekendDays: number;
  totalComplaints: number;
};

/**
 * Turns a comparison into an index. The weekday side is 100 by construction, so
 * the weekend side carries the entire difference.
 */
export function indexComparison(comparison: Comparison): BoroughIndex {
  if (comparison.kind === "no-data") {
    return { kind: "no-data" };
  }

  if (comparison.kind === "zero-baseline") {
    return { kind: "no-baseline" };
  }

  return {
    kind: "computed",
    weekdayIndex: WEEKDAY_INDEX,
    weekendIndex: WEEKDAY_INDEX * (comparison.weekendAverage / comparison.weekdayAverage),
    percentageDifference: comparison.percentageDifference,
    direction: comparison.direction,
  };
}

export function buildBoroughRow(summary: DaySummary): BoroughRow {
  return {
    borough: summary.borough,
    label: boroughLabel(summary.borough),
    index: indexComparison(summary.comparison),
    comparison: summary.comparison,
    weekdayDays: summary.weekdayDays,
    weekendDays: summary.weekendDays,
    totalComplaints: summary.totalComplaints,
  };
}

/**
 * Orders rows into the fixed citywide order and fills in any borough that failed
 * to load, so the chart always draws five rows. A borough that dropped out of a
 * five-borough chart because its request timed out would be the worst kind of
 * missing data: invisible.
 */
export function orderBoroughRows(rows: readonly BoroughRow[]): BoroughRow[] {
  return CITYWIDE_BOROUGH_ORDER.map(
    (borough) =>
      rows.find((row) => row.borough === borough) ?? {
        borough,
        label: boroughLabel(borough),
        index: { kind: "no-data" as const },
        comparison: { kind: "no-data" as const },
        weekdayDays: 0,
        weekendDays: 0,
        totalComplaints: 0,
      },
  );
}

/**
 * Which borough rose most, relative to its own weekday baseline.
 *
 * Not a ranking of anywhere being loudest, and not comparable to raw volume:
 * this is the largest within-borough ratio, and the copy that renders it says so.
 * Ties and empty sets are variants rather than an arbitrary winner, because the
 * reader is asked to predict this and deserves an honest answer when the data
 * does not produce one.
 */
export type LargestRise =
  | { kind: "leader"; borough: Borough; label: string; percentageDifference: number }
  | { kind: "tie"; boroughs: BoroughRow[]; percentageDifference: number }
  | { kind: "none" };

/** Two differences within this many points are called a tie rather than split. */
const TIE_EPSILON = 0.05;

export function largestRise(rows: readonly BoroughRow[]): LargestRise {
  const risers = rows.filter(
    (row) => row.index.kind === "computed" && row.index.direction === "higher",
  );

  if (risers.length === 0) {
    return { kind: "none" };
  }

  const best = risers.reduce((leader, row) =>
    indexOf(row) > indexOf(leader) ? row : leader,
  );
  const bestValue = indexOf(best);
  const tied = risers.filter((row) => Math.abs(indexOf(row) - bestValue) <= TIE_EPSILON);

  if (tied.length > 1) {
    return { kind: "tie", boroughs: tied, percentageDifference: bestValue };
  }

  return { kind: "leader", borough: best.borough, label: best.label, percentageDifference: bestValue };
}

function indexOf(row: BoroughRow): number {
  return row.index.kind === "computed" ? row.index.percentageDifference : Number.NEGATIVE_INFINITY;
}

/**
 * How widely the weekend pattern holds, as a fact about the rows rather than a
 * sentence written in advance.
 *
 * The transition into the Brooklyn case study wants to say the pattern is not
 * unique to Brooklyn. That is a claim about data, and the piece does not state
 * claims about data that the data has not been asked to support - if four
 * boroughs came back flat next month, a hardcoded sentence would be a lie. So the
 * shape is computed and the copy reads from it.
 */
export type PatternBreadth =
  | { kind: "all"; total: number }
  | { kind: "most"; higher: number; total: number }
  | { kind: "some"; higher: number; total: number }
  | { kind: "none"; total: number }
  | { kind: "insufficient" };

export function patternBreadth(rows: readonly BoroughRow[]): PatternBreadth {
  const computed = rows.filter((row) => row.index.kind === "computed");

  if (computed.length < 2) {
    return { kind: "insufficient" };
  }

  const higher = computed.filter(
    (row) => row.index.kind === "computed" && row.index.direction === "higher",
  ).length;

  if (higher === 0) {
    return { kind: "none", total: computed.length };
  }

  if (higher === computed.length) {
    return { kind: "all", total: computed.length };
  }

  return higher > computed.length / 2
    ? { kind: "most", higher, total: computed.length }
    : { kind: "some", higher, total: computed.length };
}
