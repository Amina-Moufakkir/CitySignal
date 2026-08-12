/**
 * Socrata query construction and fetching.
 *
 * Query builders are ported from `legacy/app.js`. The app never fetches raw
 * records; it asks for aggregate counts and lets Socrata compute the calendar
 * day, the hour, and the day of week. `date_extract_hh` and `date_extract_dow`
 * read `created_date`, which is NYC wall-clock time, so both arrive already in
 * the frame the analysis wants.
 *
 * `inspectUrl` from the original is deliberately not ported: it issued a third
 * request per load whose response was never displayed (REVIEW.md R3).
 *
 * Fetching runs on the server behind a revalidation window, so upstream load is
 * a fixed number of requests per window rather than per visitor.
 */

import {
  COMPLAINT_TYPE,
  DATASET_URL,
  DEFAULT_BOROUGH,
  normalizeBorough,
  type Borough,
  type Range,
} from "./config";
import type { MaybeRow } from "./analysis";
import { NIGHT_END_HOUR, NIGHT_START_HOUR } from "./analysis";

export const REVALIDATE_SECONDS = 21_600; // 6 hours; 311 publishes daily.

const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_RETRY_DELAY_MS = 1_200;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

// ---------------------------------------------------------------------------
// Query construction
// ---------------------------------------------------------------------------

export function whereClause(range: Range, borough: Borough = DEFAULT_BOROUGH): string {
  const selectedBorough = normalizeBorough(borough);

  return [
    `borough='${selectedBorough}'`,
    `complaint_type='${COMPLAINT_TYPE}'`,
    `created_date >= '${range.start}T00:00:00'`,
    `created_date < '${range.endExclusive}T00:00:00'`,
  ].join(" AND ");
}

export function dailyUrl(range: Range, borough: Borough = DEFAULT_BOROUGH): string {
  const params = new URLSearchParams({
    $select: "date_trunc_ymd(created_date) AS day, count(*) AS complaints",
    $where: whereClause(range, borough),
    $group: "date_trunc_ymd(created_date)",
    $order: "day",
    // 364 days per range; the cap is headroom, not a truncation risk.
    $limit: "5000",
  });

  return `${DATASET_URL}?${params.toString()}`;
}

export function hourlyUrl(range: Range, borough: Borough = DEFAULT_BOROUGH): string {
  const params = new URLSearchParams({
    $select:
      "date_trunc_ymd(created_date) AS day, date_extract_hh(created_date) AS hour, count(*) AS complaints",
    $where: whereClause(range, borough),
    $group: "date_trunc_ymd(created_date), date_extract_hh(created_date)",
    $order: "day, hour",
    // 364 x 24 = 8,736 possible groups; the cap is above the provable maximum.
    $limit: "10000",
  });

  return `${DATASET_URL}?${params.toString()}`;
}

/**
 * Descriptor counts for night hours only, grouped by day of week rather than by
 * calendar day. Verified against the live API: 169 rows for a full year, versus
 * roughly 10,900 if grouped by individual day.
 *
 * Grouping by day of week discards the information needed to exclude the two
 * incomplete boundary nights. That is safe here and only here: both configured
 * ranges run Monday-Sunday, so both boundary nights are Sunday nights, and this
 * query is used only for the peak-versus-Monday-Thursday comparison. The
 * assumption is asserted in `analysis.test.ts`, not assumed.
 */
export function descriptorNightUrl(range: Range, borough: Borough = DEFAULT_BOROUGH): string {
  const nightHours = `(date_extract_hh(created_date) >= ${NIGHT_START_HOUR} OR date_extract_hh(created_date) < ${NIGHT_END_HOUR})`;
  const params = new URLSearchParams({
    $select:
      "descriptor, date_extract_dow(created_date) AS dow, date_extract_hh(created_date) AS hour, count(*) AS complaints",
    $where: `${whereClause(range, borough)} AND ${nightHours}`,
    $group: "descriptor, date_extract_dow(created_date), date_extract_hh(created_date)",
    $order: "dow, hour",
    // 7 days x 6 night hours x descriptors; 169 rows observed for 2024 Brooklyn.
    $limit: "2000",
  });

  return `${DATASET_URL}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

/**
 * Note what is not here: an empty result set is not a failure. Socrata returning
 * `[]` with HTTP 200 is a successful fetch of zero rows, and it surfaces
 * downstream as `Comparison { kind: "no-data" }`. Modelling it as success is
 * what makes REVIEW.md B1 unrepresentable rather than merely fixed.
 */
export type Failure =
  | { kind: "rate-limited" }
  | { kind: "server"; status: number }
  | { kind: "timeout" }
  | { kind: "network" }
  | { kind: "bad-shape" };

export type FetchResult =
  | { ok: true; rows: MaybeRow[] }
  | { ok: false; failure: Failure };

export type FetchOptions = {
  timeoutMs?: number;
  retryDelayMs?: number;
  maxAttempts?: number;
  revalidate?: number;
};

/** Next augments RequestInit with `next`; declared locally so this file does not
 * depend on a generated `next-env.d.ts` to typecheck. */
type CacheableInit = RequestInit & {
  next?: { revalidate?: number | false; tags?: string[] };
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Reader-facing text for a failure. Every string here is authored in this file:
 * no upstream response body, and no request URL, ever reaches the page. The
 * JSON parser's message in particular embeds a fragment of the response body.
 */
export function describeFailure(failure: Failure): string {
  switch (failure.kind) {
    case "rate-limited":
      return "NYC Open Data is rate-limiting requests right now. This section will fill in on the next refresh.";
    case "server":
      return `NYC Open Data returned an error (HTTP ${failure.status}). This section will fill in on the next refresh.`;
    case "timeout":
      return "NYC Open Data did not respond in time. This section will fill in on the next refresh.";
    case "network":
      return "NYC Open Data could not be reached. This section will fill in on the next refresh.";
    case "bad-shape":
      return "NYC Open Data returned a response in an unexpected format, so this section is not being shown rather than shown wrong.";
  }
}

export async function fetchAggregate(url: string, options: FetchOptions = {}): Promise<FetchResult> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    maxAttempts = 2,
    revalidate = REVALIDATE_SECONDS,
  } = options;

  let lastFailure: Failure = { kind: "network" };

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      await delay(retryDelayMs * attempt);
    }

    const result = await attemptFetch(url, timeoutMs, revalidate);

    if (result.ok) {
      return result;
    }

    lastFailure = result.failure;

    // A malformed body will be malformed again, and a 400 means the query is
    // wrong. Only transport and load failures are worth a second request.
    if (!shouldRetry(result.failure)) {
      return result;
    }
  }

  return { ok: false, failure: lastFailure };
}

function shouldRetry(failure: Failure): boolean {
  switch (failure.kind) {
    case "rate-limited":
    case "timeout":
    case "network":
      return true;
    case "server":
      return isRetryableStatus(failure.status);
    case "bad-shape":
      return false;
  }
}

async function attemptFetch(
  url: string,
  timeoutMs: number,
  revalidate: number,
): Promise<FetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    const init: CacheableInit = { signal: controller.signal, next: { revalidate } };
    response = await fetch(url, init);
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { ok: false, failure: aborted ? { kind: "timeout" } : { kind: "network" } };
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    return {
      ok: false,
      failure:
        response.status === 429
          ? { kind: "rate-limited" }
          : { kind: "server", status: response.status },
    };
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    return { ok: false, failure: { kind: "bad-shape" } };
  }

  if (!Array.isArray(payload)) {
    return { ok: false, failure: { kind: "bad-shape" } };
  }

  return { ok: true, rows: payload as MaybeRow[] };
}

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}
