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

export type RangeId = "primary" | "stress";

export type Range = {
  id: RangeId;
  label: string;
  /** Inclusive, YYYY-MM-DD. */
  start: string;
  /** Exclusive, YYYY-MM-DD. */
  endExclusive: string;
  /** Human-readable inclusive span, shown to the reader. */
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
    display: "2024-01-01 through 2024-12-29",
  },
  {
    id: "stress",
    label: "Stress-test range",
    start: "2025-01-06",
    endExclusive: "2026-01-05",
    display: "2025-01-06 through 2026-01-04",
  },
];

export const PRIMARY_RANGE = RANGES[0];
export const STRESS_RANGE = RANGES[1];

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
