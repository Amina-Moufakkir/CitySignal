/**
 * Page data assembly. Runs on the server, behind the revalidation window.
 *
 * Fourteen upstream requests per window, regardless of traffic:
 *   Brooklyn daily and hourly for both ranges          4
 *   Brooklyn descriptor-by-night for both ranges       2
 *   The other four boroughs, daily and hourly, primary 8
 *
 * The hourly response is fetched once per range and feeds three summaries
 * (hourly, nights, and the night denominators), so sections 4, 5 and 8 cost no
 * extra requests between them.
 *
 * Every fetch is independent: one failing section does not blank the others.
 */

import {
  BASELINE_NIGHTS,
  buildBoardRates,
  descriptorExcess,
  peakNight,
  summarize,
  summarizeDescriptorNights,
  summarizeHourly,
  summarizeNights,
  topBoardShare,
  type BoardRate,
  type DaySummary,
  type DescriptorExcess,
  type DescriptorNightSummary,
  type HourlySummary,
  type NightSummary,
} from "./analysis";
import {
  BOROUGHS,
  DEFAULT_BOROUGH,
  PRIMARY_RANGE,
  STRESS_RANGE,
  type Borough,
  type Range,
} from "./config";
import { PHASE3_BOARD_DATASET } from "./static-data";
import {
  dailyUrl,
  descriptorNightUrl,
  fetchAggregate,
  hourlyUrl,
  type Failure,
} from "./socrata";
import { bootstrapPercentageDifference, bootstrapTopShare, type IntervalResult } from "./uncertainty";

export type Loaded<T> = { status: "ok"; value: T } | { status: "failed"; failure: Failure };

export type RangeBundle = {
  range: Range;
  borough: Borough;
  daily: Loaded<DaySummary>;
  /** Interval around the weekend-versus-weekday percentage difference. */
  dailyInterval: IntervalResult;
  hourly: Loaded<HourlySummary>;
  nights: Loaded<NightSummary>;
};

export type DescriptorBundle = {
  summary: Loaded<DescriptorNightSummary>;
  excess: DescriptorExcess;
};

export type PageData = {
  /** When the server last refreshed. Shown in the Method section. */
  fetchedAt: string;
  brooklynPrimary: RangeBundle;
  brooklynStress: RangeBundle;
  descriptorsPrimary: DescriptorBundle;
  descriptorsStress: DescriptorBundle;
  /** All five boroughs over the primary range, for the explore section. */
  boroughs: RangeBundle[];
  boards: BoardRate[];
  boardShare: { share: number; boards: string[]; total: number };
  boardShareInterval: IntervalResult;
};

/**
 * The descriptor the narrative follows. Not a finding baked into the copy: the
 * excess share is computed for it at runtime and the section states whatever
 * that comes to.
 */
export const NARRATIVE_DESCRIPTOR = "Loud Music/Party";

/** The Phase 2 hypothesis pre-registered a 40% threshold for the top three boards. */
export const BOARD_CONCENTRATION_THRESHOLD = 40;

async function loadRange(range: Range, borough: Borough): Promise<RangeBundle> {
  const [dailyResult, hourlyResult] = await Promise.all([
    fetchAggregate(dailyUrl(range, borough)),
    fetchAggregate(hourlyUrl(range, borough)),
  ]);

  const daily: Loaded<DaySummary> = dailyResult.ok
    ? { status: "ok", value: summarize(range, dailyResult.rows, borough) }
    : { status: "failed", failure: dailyResult.failure };

  const hourly: Loaded<HourlySummary> = hourlyResult.ok
    ? { status: "ok", value: summarizeHourly(range, hourlyResult.rows, borough) }
    : { status: "failed", failure: hourlyResult.failure };

  // Same rows, second summary. No extra request.
  const nights: Loaded<NightSummary> = hourlyResult.ok
    ? { status: "ok", value: summarizeNights(range, hourlyResult.rows, borough) }
    : { status: "failed", failure: hourlyResult.failure };

  const dailyInterval: IntervalResult =
    daily.status === "ok"
      ? bootstrapPercentageDifference(daily.value.weekdayCounts, daily.value.weekendCounts)
      : { kind: "unavailable" };

  return { range, borough, daily, dailyInterval, hourly, nights };
}

async function loadDescriptors(
  range: Range,
  borough: Borough,
  nights: Loaded<NightSummary>,
): Promise<DescriptorBundle> {
  const result = await fetchAggregate(descriptorNightUrl(range, borough));

  if (!result.ok) {
    return { summary: { status: "failed", failure: result.failure }, excess: { kind: "no-data" } };
  }

  const summary = summarizeDescriptorNights(range, result.rows, borough);

  // The peak night comes from the data, never from an assumption that it is
  // Saturday. If the nights summary failed, there is no peak to compare against.
  if (nights.status !== "ok") {
    return { summary: { status: "ok", value: summary }, excess: { kind: "no-data" } };
  }

  const peak = peakNight(nights.value);

  if (peak.kind === "none") {
    return { summary: { status: "ok", value: summary }, excess: { kind: "no-data" } };
  }

  return {
    summary: { status: "ok", value: summary },
    excess: descriptorExcess(summary, NARRATIVE_DESCRIPTOR, peak.night.weekday, BASELINE_NIGHTS),
  };
}

/**
 * The board interval is over a static committed dataset, so it never changes.
 * Computed once per process rather than on every render.
 */
let boardShareIntervalCache: IntervalResult | null = null;

export function boardShareInterval(): IntervalResult {
  if (boardShareIntervalCache === null) {
    boardShareIntervalCache = bootstrapTopShare(
      PHASE3_BOARD_DATASET.rows.map((row) => row.saturdayNightComplaints),
      3,
    );
  }

  return boardShareIntervalCache;
}

export async function loadPageData(): Promise<PageData> {
  const otherBoroughs = BOROUGHS.map((borough) => borough.value).filter(
    (borough): borough is Borough => borough !== DEFAULT_BOROUGH,
  );

  const [brooklynPrimary, brooklynStress, ...rest] = await Promise.all([
    loadRange(PRIMARY_RANGE, DEFAULT_BOROUGH),
    loadRange(STRESS_RANGE, DEFAULT_BOROUGH),
    ...otherBoroughs.map((borough) => loadRange(PRIMARY_RANGE, borough)),
  ]);

  const [descriptorsPrimary, descriptorsStress] = await Promise.all([
    loadDescriptors(PRIMARY_RANGE, DEFAULT_BOROUGH, brooklynPrimary.nights),
    loadDescriptors(STRESS_RANGE, DEFAULT_BOROUGH, brooklynStress.nights),
  ]);

  return {
    fetchedAt: new Date().toISOString(),
    brooklynPrimary,
    brooklynStress,
    descriptorsPrimary,
    descriptorsStress,
    boroughs: [brooklynPrimary, ...rest],
    boards: buildBoardRates(),
    boardShare: topBoardShare(3),
    boardShareInterval: boardShareInterval(),
  };
}
