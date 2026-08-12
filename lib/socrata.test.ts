import { describe, expect, test } from "vitest";

import { BOROUGHS, DEFAULT_BOROUGH, RANGES, normalizeBorough, type Range } from "./config";
import { dailyUrl, hourlyUrl, whereClause } from "./socrata";

const WEEK: Range = {
  id: "primary",
  label: "Test week",
  start: "2024-01-01",
  endExclusive: "2024-01-08",
  display: "2024-01-01 through 2024-01-07",
};

function readable(url: string): string {
  return decodeURIComponent(url).replace(/\+/g, " ");
}

describe("borough configuration", () => {
  test("defines exactly five valid borough choices", () => {
    expect(BOROUGHS.map((borough) => borough.value)).toEqual([
      "BROOKLYN",
      "MANHATTAN",
      "QUEENS",
      "BRONX",
      "STATEN ISLAND",
    ]);
  });

  test("falls back to Brooklyn for invalid borough values", () => {
    expect(normalizeBorough("BROOKLYNN")).toBe(DEFAULT_BOROUGH);
    expect(normalizeBorough("")).toBe(DEFAULT_BOROUGH);
    expect(normalizeBorough(null)).toBe(DEFAULT_BOROUGH);
    expect(normalizeBorough(undefined)).toBe(DEFAULT_BOROUGH);
    expect(readable(whereClause(WEEK, "BROOKLYNN" as never))).toContain("borough='BROOKLYN'");
  });
});

describe("query construction", () => {
  test("builds borough-specific daily and hourly URLs", () => {
    for (const borough of BOROUGHS) {
      const daily = readable(dailyUrl(WEEK, borough.value));
      const hourly = readable(hourlyUrl(WEEK, borough.value));

      expect(daily).toContain(`borough='${borough.value}'`);
      expect(hourly).toContain(`borough='${borough.value}'`);
      expect(daily).toContain("complaint_type='Noise - Residential'");
      expect(hourly).toContain("date_extract_hh(created_date) AS hour");
    }
  });

  test("produces a distinct URL per borough", () => {
    const urls = new Set(BOROUGHS.map((borough) => dailyUrl(WEEK, borough.value)));

    expect(urls.size).toBe(BOROUGHS.length);
  });

  test("bounds the range with a half-open interval", () => {
    const clause = readable(whereClause(RANGES[0]));

    expect(clause).toContain("created_date >= '2024-01-01T00:00:00'");
    expect(clause).toContain("created_date < '2024-12-30T00:00:00'");
  });

  // Hour of day is computed by Socrata from created_date, which is NYC
  // wall-clock time. Nothing client-side re-derives it.
  test("delegates day and hour extraction to Socrata", () => {
    const hourly = readable(hourlyUrl(RANGES[0]));

    expect(hourly).toContain("date_trunc_ymd(created_date) AS day");
    expect(hourly).toContain("date_extract_hh(created_date) AS hour");
    expect(hourly).toContain("$group=date_trunc_ymd(created_date), date_extract_hh(created_date)");
  });

  test("row limits stay above the provable maxima for a 364-day range", () => {
    expect(readable(dailyUrl(RANGES[0]))).toContain("$limit=5000");
    expect(readable(hourlyUrl(RANGES[0]))).toContain("$limit=10000");
    expect(364).toBeLessThan(5000);
    expect(364 * 24).toBeLessThan(10000);
  });

  test("does not build an inspect query", async () => {
    const socrata: Record<string, unknown> = await import("./socrata");

    expect(Object.keys(socrata)).not.toContain("inspectUrl");
  });
});
