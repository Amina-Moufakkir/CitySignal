import { describe, expect, test } from "vitest";

import { RANGES, type Range } from "./config";
import {
  BASELINE_NIGHTS,
  countCompleteNights,
  descriptorExcess,
  isWeekendDay,
  nightAnchorDow,
  nightOf,
  summarizeDescriptorNights,
  utcDateFromDay,
  type MaybeRow,
} from "./analysis";

const WEEK: Range = {
  id: "primary",
  label: "Test week",
  start: "2024-01-01",
  endExclusive: "2024-01-08",
  display: "2024-01-01 through 2024-01-07",
};

function row(descriptor: string, dow: number, hour: number, complaints: number): MaybeRow {
  return {
    descriptor,
    dow: String(dow),
    hour: String(hour),
    complaints: String(complaints),
  };
}

describe("nightAnchorDow", () => {
  // Two implementations of the same rule exist: nightOf works on calendar days
  // for the day x hour aggregate, nightAnchorDow works on weekdays for the
  // dow x hour aggregate. This pins them together so they cannot drift.
  test("agrees with nightOf for every day of a full week and every night hour", () => {
    const days = [
      "2024-01-01",
      "2024-01-02",
      "2024-01-03",
      "2024-01-04",
      "2024-01-05",
      "2024-01-06",
      "2024-01-07",
      "2024-02-29",
      "2024-12-31",
      "2025-01-01",
    ];

    for (const day of days) {
      for (const hour of [22, 23, 0, 1, 2, 3]) {
        const anchorDay = nightOf(day, hour);
        expect(anchorDay).not.toBeNull();

        const fromDay = utcDateFromDay(anchorDay!).getUTCDay();
        const fromDow = nightAnchorDow(utcDateFromDay(day).getUTCDay(), hour);

        expect(fromDow, `${day} @ ${hour}`).toBe(fromDay);
      }
    }
  });

  test("returns null outside night hours and for invalid input", () => {
    expect(nightAnchorDow(6, 4)).toBeNull();
    expect(nightAnchorDow(6, 21)).toBeNull();
    expect(nightAnchorDow(7, 22)).toBeNull();
    expect(nightAnchorDow(-1, 22)).toBeNull();
    expect(nightAnchorDow(6, 1.5)).toBeNull();
  });
});

describe("dow-grouped aggregation safety", () => {
  // Grouping by day of week loses the information needed to exclude the two
  // incomplete boundary nights. That is only safe because both fall on Sunday,
  // and neither the peak night nor the Monday-Thursday baseline is Sunday.
  // Asserted here rather than assumed in a comment.
  test("every dropped boundary night is a Sunday in both configured ranges", () => {
    for (const range of RANGES) {
      const { droppedNights, countsByWeekday } = countCompleteNights(range);

      expect(droppedNights, range.label).toHaveLength(2);

      for (const dropped of droppedNights) {
        expect(utcDateFromDay(dropped).getUTCDay(), `${range.label} ${dropped}`).toBe(0);
        expect(isWeekendDay(dropped)).toBe(true);
      }

      // Monday-first indices 0-5 are Monday..Saturday; index 6 is Sunday.
      expect(countsByWeekday.slice(0, 6), range.label).toEqual([52, 52, 52, 52, 52, 52]);
      expect(countsByWeekday[6], range.label).toBe(51);
    }
  });

  test("the Monday-Thursday baseline never includes Sunday", () => {
    expect(BASELINE_NIGHTS).not.toContain("Sunday");
    expect(BASELINE_NIGHTS).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday"]);
  });
});

describe("summarizeDescriptorNights", () => {
  test("attributes early-morning hours to the previous night", () => {
    // dow 0 is Sunday. Sunday 01:00 belongs to Saturday night.
    const summary = summarizeDescriptorNights(WEEK, [
      row("Loud Music/Party", 6, 22, 100),
      row("Loud Music/Party", 0, 1, 60),
      row("Banging/Pounding", 6, 23, 10),
    ]);

    const saturday = summary.weekdays.find((day) => day.weekday === "Saturday")!;
    const sunday = summary.weekdays.find((day) => day.weekday === "Sunday")!;

    expect(saturday.total).toBe(170);
    expect(saturday.byDescriptor["Loud Music/Party"]).toBe(160);
    expect(saturday.byDescriptor["Banging/Pounding"]).toBe(10);
    expect(sunday.total).toBe(0);
  });

  test("orders descriptors by total and counts rejected rows", () => {
    const summary = summarizeDescriptorNights(WEEK, [
      row("Loud Talking", 6, 22, 5),
      row("Loud Music/Party", 6, 22, 90),
      row("Banging/Pounding", 6, 22, 40),
      // Rejected: not a night hour, blank descriptor, bad count, null row.
      row("Loud Music/Party", 6, 14, 999),
      row("", 6, 22, 5),
      { descriptor: "Loud Music/Party", dow: "6", hour: "22", complaints: "abc" },
      { descriptor: "Loud Music/Party", dow: "6", hour: "22", complaints: null },
      null,
    ]);

    expect(summary.descriptors).toEqual([
      "Loud Music/Party",
      "Banging/Pounding",
      "Loud Talking",
    ]);
    expect(summary.rejectedRows).toBe(5);
    expect(summary.totalComplaints).toBe(135);
  });

  test("uses calendar night denominators, not a uniform 52", () => {
    const summary = summarizeDescriptorNights(RANGES[0], []);
    const counted = Object.fromEntries(
      summary.weekdays.map((day) => [day.weekday, day.nightsCounted]),
    );

    expect(counted.Saturday).toBe(52);
    expect(counted.Sunday).toBe(51);
    expect(summary.hasData).toBe(false);
  });
});

describe("descriptorExcess", () => {
  // Rates, not raw totals: four baseline nights per week against the peak's one.
  test("divides the excess by nights before comparing", () => {
    const summary = summarizeDescriptorNights(WEEK, [
      // Saturday night: 200 total, 180 of them Loud Music/Party.
      row("Loud Music/Party", 6, 22, 180),
      row("Banging/Pounding", 6, 22, 20),
      // Each of Mon-Thu: 50 total, 20 Loud Music/Party.
      ...[1, 2, 3, 4].flatMap((dow) => [
        row("Loud Music/Party", dow, 22, 20),
        row("Banging/Pounding", dow, 22, 30),
      ]),
    ]);

    const excess = descriptorExcess(summary, "Loud Music/Party", "Saturday");

    expect(excess.kind).toBe("computed");
    if (excess.kind !== "computed") return;
    expect(excess.peakPerNight).toBe(200);
    expect(excess.baselinePerNight).toBe(50);
    expect(excess.excessPerNight).toBe(150);
    expect(excess.excessDescriptorPerNight).toBe(160);
    // Loud Music/Party more than accounts for the excess: other descriptors fell.
    expect(Number(excess.shareOfExcess.toFixed(1))).toBe(106.7);
  });

  test("reports the share when the descriptor explains most of the excess", () => {
    const summary = summarizeDescriptorNights(WEEK, [
      row("Loud Music/Party", 6, 22, 120),
      row("Banging/Pounding", 6, 22, 40),
      ...[1, 2, 3, 4].flatMap((dow) => [
        row("Loud Music/Party", dow, 22, 30),
        row("Banging/Pounding", dow, 22, 30),
      ]),
    ]);

    const excess = descriptorExcess(summary, "Loud Music/Party", "Saturday");

    expect(excess.kind).toBe("computed");
    if (excess.kind !== "computed") return;
    expect(excess.excessPerNight).toBe(100);
    expect(excess.excessDescriptorPerNight).toBe(90);
    expect(excess.shareOfExcess).toBe(90);
  });

  test("returns no-excess when the peak does not exceed the baseline", () => {
    const summary = summarizeDescriptorNights(WEEK, [
      row("Loud Music/Party", 6, 22, 10),
      ...[1, 2, 3, 4].map((dow) => row("Loud Music/Party", dow, 22, 40)),
    ]);

    expect(descriptorExcess(summary, "Loud Music/Party", "Saturday")).toEqual({
      kind: "no-excess",
    });
  });

  test("returns no-excess when the derived peak is inside the baseline", () => {
    const summary = summarizeDescriptorNights(WEEK, [row("Loud Music/Party", 2, 22, 10)]);

    expect(descriptorExcess(summary, "Loud Music/Party", "Tuesday")).toEqual({
      kind: "no-excess",
    });
  });

  test("returns no-data when nothing was collected", () => {
    const summary = summarizeDescriptorNights(WEEK, []);

    expect(descriptorExcess(summary, "Loud Music/Party", "Saturday")).toEqual({ kind: "no-data" });
  });

  test("treats a missing descriptor as zero rather than throwing", () => {
    const summary = summarizeDescriptorNights(WEEK, [
      row("Banging/Pounding", 6, 22, 100),
      ...[1, 2, 3, 4].map((dow) => row("Banging/Pounding", dow, 22, 20)),
    ]);

    const excess = descriptorExcess(summary, "Loud Music/Party", "Saturday");

    expect(excess.kind).toBe("computed");
    if (excess.kind !== "computed") return;
    expect(excess.excessDescriptorPerNight).toBe(0);
    expect(excess.shareOfExcess).toBe(0);
  });
});
