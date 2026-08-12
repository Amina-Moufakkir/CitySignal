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
 *
 * Requests are issued a few at a time rather than all at once. Firing all twelve
 * simultaneously made Socrata throttle, which turned into timeouts, which took
 * out the hourly response and every section derived from it on a live
 * deployment. The page degraded rather than broke - which is the point of the
 * failure types - but a degraded page is still the wrong page, so the call
 * pattern is the fix rather than a longer timeout alone.
 */

/** How many upstream requests may be in flight at once. */
const CONCURRENCY = 3;

/**
 * Aggregate queries over a full year are slow, and slower when the dataset is
 * busy. This is generous on purpose: a timeout here silently removes a section.
 */
const FETCH_OPTIONS = { timeoutMs: 30_000, maxAttempts: 3, retryDelayMs: 2_000 };

/** Runs tasks with a fixed ceiling on concurrency, preserving input order. */
async function mapLimited<T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await run(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

  return results;
}

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
import { buildDailySeries, type DailySeries } from "./series";
import { buildNightGrid, type NightGrid } from "./night-grid";

export type Loaded<T> = { status: "ok"; value: T } | { status: "failed"; failure: Failure };

export type RangeBundle = {
  range: Range;
  borough: Borough;
  daily: Loaded<DaySummary>;
  /**
   * The same validated rows in calendar order, for the corpus chart. Derived
   * from the daily fetch; it costs no extra request.
   */
  dailySeries: DailySeries | null;
  /** Interval around the weekend-versus-weekday percentage difference. */
  dailyInterval: IntervalResult;
  hourly: Loaded<HourlySummary>;
  nights: Loaded<NightSummary>;
  /**
   * Every night of the peak weekday, hour by hour. Derived from the same hourly
   * response; the weekday comes from the data, never assumed.
   */
  nightGrid: NightGrid | null;
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
  const [dailyResult, hourlyResult] = await mapLimited(
    [dailyUrl(range, borough), hourlyUrl(range, borough)],
    2,
    (url) => fetchAggregate(url, FETCH_OPTIONS),
  );

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

  const dailySeries = dailyResult.ok ? buildDailySeries(range, dailyResult.rows) : null;

  const peak = nights.status === "ok" ? peakNight(nights.value) : { kind: "none" as const };
  const nightGrid =
    hourlyResult.ok && peak.kind === "peak"
      ? buildNightGrid(range, hourlyResult.rows, peak.night.weekday)
      : null;

  return { range, borough, daily, dailySeries, dailyInterval, hourly, nights, nightGrid };
}

async function loadDescriptors(
  range: Range,
  borough: Borough,
  nights: Loaded<NightSummary>,
): Promise<DescriptorBundle> {
  const result = await fetchAggregate(descriptorNightUrl(range, borough), FETCH_OPTIONS);

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

  const plan: { range: Range; borough: Borough }[] = [
    { range: PRIMARY_RANGE, borough: DEFAULT_BOROUGH },
    { range: STRESS_RANGE, borough: DEFAULT_BOROUGH },
    ...otherBoroughs.map((borough) => ({ range: PRIMARY_RANGE, borough })),
  ];

  const [brooklynPrimary, brooklynStress, ...rest] = await mapLimited(plan, CONCURRENCY, (entry) =>
    loadRange(entry.range, entry.borough),
  );

  const [descriptorsPrimary, descriptorsStress] = await mapLimited(
    [
      { range: PRIMARY_RANGE, nights: brooklynPrimary.nights },
      { range: STRESS_RANGE, nights: brooklynStress.nights },
    ],
    2,
    (entry) => loadDescriptors(entry.range, DEFAULT_BOROUGH, entry.nights),
  );

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
