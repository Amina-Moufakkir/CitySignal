/**
 * Live verification against NYC Open Data.
 *
 * Not part of `npm test`: it makes real network requests, and unauthenticated
 * Socrata throttles quickly, so a failure here is as likely to mean "rate
 * limited" as "regression". Run it deliberately:
 *
 *     npm run verify:live
 *
 * The Phase 1-3 version of this script asserted exact integer equality against
 * frozen totals. 311 data is revised and backfilled continuously, so that script
 * was guaranteed to fail eventually and to look like a code regression when it
 * did. This asserts two things instead:
 *
 *   1. Structural invariants that must hold whatever the data says - denominator
 *      counts, night counts, the shape of every summary.
 *   2. Headline figures within a tolerance of values captured on a stated date,
 *      so genuine drift is visible without being fatal.
 */

import { describe, expect, test } from "vitest";

import {
  BASELINE_NIGHTS,
  descriptorExcess,
  peakNight,
  summarize,
  summarizeDescriptorNights,
  summarizeHourly,
  summarizeNights,
} from "../lib/analysis";
import { DEFAULT_BOROUGH, PRIMARY_RANGE, RANGES, STRESS_RANGE } from "../lib/config";
import { dailyUrl, descriptorNightUrl, fetchAggregate, hourlyUrl } from "../lib/socrata";
import { NARRATIVE_DESCRIPTOR } from "../lib/data";

/** Values observed on this date. Update both together, never one alone. */
const CAPTURED_ON = "2026-08-12";
const CAPTURED = {
  primaryDifference: 77.8,
  stressDifference: 76.3,
  primaryExcessShare: 96.4,
  stressExcessShare: 93.7,
  peakWeekday: "Saturday",
};

/** Wide enough to absorb ordinary revision, tight enough to catch a real break. */
const PERCENT_TOLERANCE = 6;
const SHARE_TOLERANCE = 4;

const enabled = process.env.VERIFY_LIVE === "1";
const suite = enabled ? describe : describe.skip;

if (!enabled) {
  // eslint-disable-next-line no-console
  console.log("verify-live skipped. Run with VERIFY_LIVE=1, or `npm run verify:live`.");
}

async function rowsFor(url: string) {
  const result = await fetchAggregate(url, { revalidate: 0, timeoutMs: 30_000 });

  if (!result.ok) {
    throw new Error(
      `Upstream fetch failed (${result.failure.kind}). This is usually rate limiting, not a regression.`,
    );
  }

  return result.rows;
}

suite("live verification", () => {
  test(
    "daily comparison reproduces for both periods",
    { timeout: 120_000 },
    async () => {
      for (const range of RANGES) {
        const summary = summarize(range, await rowsFor(dailyUrl(range, DEFAULT_BOROUGH)), DEFAULT_BOROUGH);

        // Structural: true regardless of what the data says.
        expect(summary.weekdayDays, range.label).toBe(260);
        expect(summary.weekendDays, range.label).toBe(104);
        expect(summary.rejectedRows, range.label).toBe(0);
        expect(summary.comparison.kind, range.label).toBe("computed");

        if (summary.comparison.kind !== "computed") return;

        expect(summary.comparison.direction, range.label).toBe("higher");
        expect(summary.totalComplaints, range.label).toBeGreaterThan(50_000);

        const expected =
          range.id === "primary" ? CAPTURED.primaryDifference : CAPTURED.stressDifference;

        expect(
          Math.abs(summary.comparison.percentageDifference - expected),
          `${range.label}: ${summary.comparison.percentageDifference.toFixed(1)}% vs ${expected}% captured ${CAPTURED_ON}`,
        ).toBeLessThan(PERCENT_TOLERANCE);
      }
    },
  );

  test(
    "night counts and the peak night reproduce",
    { timeout: 120_000 },
    async () => {
      const rows = await rowsFor(hourlyUrl(PRIMARY_RANGE, DEFAULT_BOROUGH));
      const hourly = summarizeHourly(PRIMARY_RANGE, rows, DEFAULT_BOROUGH);
      const nights = summarizeNights(PRIMARY_RANGE, rows, DEFAULT_BOROUGH);

      expect(hourly.rejectedRows).toBe(0);
      expect(hourly.hours).toHaveLength(24);

      const counted = Object.fromEntries(nights.nights.map((n) => [n.weekday, n.nightsCounted]));
      expect(counted).toEqual({
        Monday: 52,
        Tuesday: 52,
        Wednesday: 52,
        Thursday: 52,
        Friday: 52,
        Saturday: 52,
        Sunday: 51,
      });
      expect(nights.droppedNights).toEqual(["2023-12-31", "2024-12-29"]);

      const peak = peakNight(nights);
      expect(peak.kind).toBe("peak");
      if (peak.kind !== "peak") return;
      expect(peak.night.weekday).toBe(CAPTURED.peakWeekday);
    },
  );

  test(
    "descriptor decomposition reproduces for both periods",
    { timeout: 120_000 },
    async () => {
      for (const range of RANGES) {
        const nights = summarizeNights(
          range,
          await rowsFor(hourlyUrl(range, DEFAULT_BOROUGH)),
          DEFAULT_BOROUGH,
        );
        const peak = peakNight(nights);
        expect(peak.kind, range.label).toBe("peak");
        if (peak.kind !== "peak") return;

        const summary = summarizeDescriptorNights(
          range,
          await rowsFor(descriptorNightUrl(range, DEFAULT_BOROUGH)),
          DEFAULT_BOROUGH,
        );
        expect(summary.rejectedRows, range.label).toBe(0);
        expect(summary.descriptors, range.label).toContain(NARRATIVE_DESCRIPTOR);

        const excess = descriptorExcess(
          summary,
          NARRATIVE_DESCRIPTOR,
          peak.night.weekday,
          BASELINE_NIGHTS,
        );
        expect(excess.kind, range.label).toBe("computed");
        if (excess.kind !== "computed") return;

        const expected =
          range.id === "primary" ? CAPTURED.primaryExcessShare : CAPTURED.stressExcessShare;

        expect(
          Math.abs(excess.shareOfExcess - expected),
          `${range.label}: ${excess.shareOfExcess.toFixed(1)}% vs ${expected}% captured ${CAPTURED_ON}`,
        ).toBeLessThan(SHARE_TOLERANCE);
      }
    },
  );

  test("every borough returns usable data", { timeout: 120_000 }, async () => {
    const { BOROUGHS } = await import("../lib/config");

    for (const borough of BOROUGHS) {
      const summary = summarize(
        PRIMARY_RANGE,
        await rowsFor(dailyUrl(PRIMARY_RANGE, borough.value)),
        borough.value,
      );

      expect(summary.comparison.kind, borough.label).toBe("computed");
      expect(summary.rejectedRows, borough.label).toBe(0);
      expect(summary.totalComplaints, borough.label).toBeGreaterThan(0);
    }
  });

  test("the stress period does not overlap the primary period", () => {
    expect(STRESS_RANGE.start >= PRIMARY_RANGE.endExclusive).toBe(true);
  });
});
