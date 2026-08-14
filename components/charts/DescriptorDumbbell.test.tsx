import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DescriptorDumbbell } from "./DescriptorDumbbell";
import type { DescriptorNightSummary, WeekdayLabel } from "@/lib/analysis";
import { PRIMARY_RANGE } from "@/lib/config";

/**
 * Four descriptors, three of which put Saturday within a whisker of the
 * baseline - the real shape of this data, and the case where the two endpoints
 * of a row land on top of each other.
 */
const DESCRIPTORS = ["Loud Music/Party", "Banging/Pounding", "Loud Talking", "Loud Television"];

function night(weekday: WeekdayLabel, byDescriptor: Record<string, number>) {
  return {
    weekday,
    nightsCounted: 1,
    total: Object.values(byDescriptor).reduce((sum, value) => sum + value, 0),
    byDescriptor,
  };
}

const SUMMARY: DescriptorNightSummary = {
  range: PRIMARY_RANGE,
  borough: "BROOKLYN",
  descriptors: DESCRIPTORS,
  weekdays: [
    night("Saturday", {
      "Loud Music/Party": 192.9,
      "Banging/Pounding": 30.7,
      "Loud Talking": 12.2,
      "Loud Television": 2.4,
    }),
    night("Monday", {
      "Loud Music/Party": 40.4,
      "Banging/Pounding": 29.3,
      "Loud Talking": 8.0,
      "Loud Television": 2.3,
    }),
  ],
  totalComplaints: 1000,
  hasData: true,
  rejectedRows: 0,
};

function render(highlight = "Loud Music/Party") {
  return renderToStaticMarkup(
    <DescriptorDumbbell
      summary={SUMMARY}
      peakWeekday="Saturday"
      baselineWeekdays={["Monday"]}
      highlight={highlight}
    />,
  );
}

/** Circles carrying a class, in document order, ignoring the table twin. */
function circleClasses(markup: string): string[] {
  return [...markup.matchAll(/<circle class="([^"]+)"/g)].map((match) => match[1]);
}

describe("DescriptorDumbbell series identity", () => {
  /**
   * The legend says an orange dot means Saturday night. If three rows of four
   * draw that dot grey, the legend is wrong for most of the chart - a series
   * cannot change its encoding row by row and still be one series.
   */
  it("draws every Saturday endpoint with the accent class, not only the highlighted row", () => {
    const circles = circleClasses(render());

    expect(circles.length).toBe(DESCRIPTORS.length + 1); // one per row, plus the legend
    for (const className of circles) {
      expect(className).toContain("marker-accent");
    }
  });

  it("holds regardless of which descriptor is highlighted", () => {
    for (const highlight of [...DESCRIPTORS, "not-a-descriptor"]) {
      for (const className of circleClasses(render(highlight))) {
        expect(className, `highlight=${highlight}`).toContain("marker-accent");
      }
    }
  });

  it("never falls back to a muted Saturday mark", () => {
    expect(render()).not.toContain("marker-muted-solid");
  });

  it("keeps every baseline endpoint a grey tick, one per row plus the legend", () => {
    const ticks = [...render().matchAll(/<line class="endpoint-tick"/g)];

    expect(ticks.length).toBe(DESCRIPTORS.length + 1);
  });

  /**
   * The connector is the difference between the two ends, which is what the
   * chart is about, so it carries the accent on every row. A short connector is
   * short because the difference is small, not because the row matters less.
   */
  it("draws every connector with the accent class", () => {
    const markup = render();
    const connectors = [...markup.matchAll(/<line class="dumbbell-([a-z]+)"/g)].map((m) => m[1]);

    expect(connectors).toHaveLength(DESCRIPTORS.length);
    expect(new Set(connectors)).toEqual(new Set(["accent"]));
    expect(markup).not.toContain("dumbbell-muted");
  });

  it("emphasises the highlighted descriptor through text, not through its marks", () => {
    const markup = render();

    expect([...markup.matchAll(/class="value-label"/g)]).toHaveLength(1);
    expect([...markup.matchAll(/row-label-strong/g)]).toHaveLength(1);
  });

  it("moves that emphasis with the highlight, leaving the marks alone", () => {
    const markup = render("Loud Talking");

    expect(markup).toMatch(/row-label-strong[^>]*>Loud Talking</);
    expect(new Set(circleClasses(markup))).toEqual(new Set(["marker-accent"]));
  });

  it("places the endpoints at their true values, unchanged by the encoding", () => {
    const markup = render();
    const ticks = [...markup.matchAll(/<line class="endpoint-tick" x1="([\d.]+)"/g)].map((m) =>
      Number(m[1]),
    );
    const dots = [...markup.matchAll(/<circle class="marker-accent" cx="([\d.]+)"/g)].map((m) =>
      Number(m[1]),
    );

    // Rows are ordered by Saturday value descending, so Loud Music/Party leads
    // and Loud Television trails; its two endpoints (2.3 and 2.4) sit within a
    // pixel of each other, which is the case the tick-and-dot pairing exists for.
    expect(dots[0]).toBeGreaterThan(ticks[0]);
    expect(Math.abs(dots[3] - ticks[3])).toBeLessThan(2);
    expect(ticks[3]).toBeLessThan(dots[3]);
  });
});
