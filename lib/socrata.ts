/**
 * Socrata query construction, ported from `legacy/app.js`.
 *
 * The app never fetches raw records. It asks for aggregate counts over the three
 * fields the analysis needs, and lets Socrata compute the calendar day and the
 * hour. `date_extract_hh` reads `created_date`, which is NYC wall-clock time, so
 * hours arrive already in the frame the analysis wants.
 *
 * `inspectUrl` from the original is deliberately not ported: it issued a third
 * request per load whose response was never displayed (REVIEW.md R3).
 */

import {
  COMPLAINT_TYPE,
  DATASET_URL,
  DEFAULT_BOROUGH,
  normalizeBorough,
  type Borough,
  type Range,
} from "./config";

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
