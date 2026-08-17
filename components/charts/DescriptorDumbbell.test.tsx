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

/**
 * The chart ships two drawings - the legend inline, and the legend stacked for
 * narrow chart widths - so every assertion about marks is made against one of
 * them rather than against the pair. Scoped, not relaxed: the counts below are
 * the same counts as before, per drawing.
 */
function variant(markup: string, which: "inline" | "stacked"): string {
  const start = markup.indexOf(`descriptor-legend-${which}`);
  const end = markup.indexOf("</svg>", start);

  expect(start, `no ${which} variant rendered`).toBeGreaterThan(-1);

  return markup.slice(start, end);
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
    const circles = circleClasses(variant(render(), "inline"));

    expect(circles.length).toBe(DESCRIPTORS.length + 1); // one per row, plus the legend
    for (const className of circles) {
      expect(className).toContain("marker-accent");
    }
  });

  it("holds regardless of which descriptor is highlighted", () => {
    for (const highlight of [...DESCRIPTORS, "not-a-descriptor"]) {
      for (const className of circleClasses(variant(render(highlight), "inline"))) {
        expect(className, `highlight=${highlight}`).toContain("marker-accent");
      }
    }
  });

  it("never falls back to a muted Saturday mark", () => {
    expect(render()).not.toContain("marker-muted-solid");
  });

  it("keeps every baseline endpoint a grey tick, one per row plus the legend", () => {
    const ticks = [...variant(render(), "inline").matchAll(/<line class="endpoint-tick"/g)];

    expect(ticks.length).toBe(DESCRIPTORS.length + 1);
  });

  /**
   * The connector is the difference between the two ends, which is what the
   * chart is about, so it carries the accent on every row. A short connector is
   * short because the difference is small, not because the row matters less.
   */
  it("draws every connector with the accent class", () => {
    const markup = variant(render(), "inline");
    const connectors = [...markup.matchAll(/<line class="dumbbell-([a-z]+)"/g)].map((m) => m[1]);

    expect(connectors).toHaveLength(DESCRIPTORS.length);
    expect(new Set(connectors)).toEqual(new Set(["accent"]));
    expect(markup).not.toContain("dumbbell-muted");
  });

  it("emphasises the highlighted descriptor through text, not through its marks", () => {
    const markup = variant(render(), "inline");

    expect([...markup.matchAll(/class="value-label"/g)]).toHaveLength(1);
    expect([...markup.matchAll(/row-label-strong/g)]).toHaveLength(1);
  });

  it("moves that emphasis with the highlight, leaving the marks alone", () => {
    const markup = variant(render("Loud Talking"), "inline");

    expect(markup).toMatch(/row-label-strong[^>]*>Loud Talking</);
    expect(new Set(circleClasses(markup))).toEqual(new Set(["marker-accent"]));
  });

  it("places the endpoints at their true values, unchanged by the encoding", () => {
    const markup = variant(render(), "inline");
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

/** The legend's own marks and labels, in document order, for one drawing. */
function legend(markup: string) {
  const block = markup.slice(markup.indexOf('<g class="chart-legend">'));
  const labels = [...block.matchAll(/<text class="series-label" x="([\d.]+)" y="([\d.]+)" dy="([^"]+)">([^<]*)/g)].map(
    (m) => ({ x: Number(m[1]), y: Number(m[2]), dy: m[3], text: m[4] }),
  );
  const tick = /<line class="endpoint-tick" x1="([\d.]+)" y1="([\d.]+)" x2="[\d.]+" y2="([\d.]+)"/.exec(block);
  const dot = /<circle class="marker-accent" cx="([\d.]+)" cy="([\d.]+)"/.exec(block);

  return {
    labels,
    tick: { x: Number(tick![1]), centre: (Number(tick![2]) + Number(tick![3])) / 2 },
    dot: { x: Number(dot![1]), centre: Number(dot![2]) },
  };
}

describe("DescriptorDumbbell legend", () => {
  /**
   * The regression this exists for: the two entries were on one line 138 units
   * apart, which holds at 12-unit type and fails everywhere below. At a 390px
   * viewport "baseline night" measures 244 units and runs 106 units through the
   * entry beside it; at 320px it is 288 and overruns by 150. There was one
   * drawing then, so there was no width at which the legend could be honest.
   */
  it("ships an inline legend and a stacked one", () => {
    const markup = render();

    expect(markup).toContain("descriptor-legend-inline");
    expect(markup).toContain("descriptor-legend-stacked");
    expect([...markup.matchAll(/<svg/g)]).toHaveLength(2);
  });

  it("keeps the two entries on one line at full width", () => {
    const { labels, tick, dot } = legend(variant(render(), "inline"));

    expect(labels).toHaveLength(2);
    expect(labels[0].y).toBe(labels[1].y);
    expect(labels[1].x).toBeGreaterThan(labels[0].x);
    expect(tick.centre).toBe(dot.centre);
  });

  /**
   * Stacked, the entries share a left edge and separate vertically. They must
   * not simply be further apart on one line: at the narrow end there is no line
   * long enough for two labels of this length.
   */
  it("stacks the two entries on separate lines, aligned on one left edge", () => {
    const { labels, tick, dot } = legend(variant(render(), "stacked"));

    expect(labels).toHaveLength(2);
    expect(labels[0].x).toBe(labels[1].x);
    expect(labels[1].y).toBeGreaterThan(labels[0].y);
    expect(tick.x).toBe(dot.x);
    expect(dot.centre).toBeGreaterThan(tick.centre);
  });

  it("centres each label on its own mark in em, at every type size", () => {
    for (const which of ["inline", "stacked"] as const) {
      const { labels, tick, dot } = legend(variant(render(), which));

      // `y` is the mark's centre and `dy` does the optical centring, so the
      // pairing survives the chart's type scaling instead of holding at one size.
      expect(labels[0].y, which).toBe(tick.centre);
      expect(labels[1].y, which).toBe(dot.centre);
      expect(labels[0].dy).toBe("0.32em");
      expect(labels[1].dy).toBe("0.32em");
    }
  });

  it("writes both entries out in full in both drawings", () => {
    for (const which of ["inline", "stacked"] as const) {
      const { labels } = legend(variant(render(), which));

      expect(labels.map((label) => label.text)).toEqual(["baseline night", "Saturday night"]);
    }
  });

  /**
   * The stacked drawing needs the extra line of headroom, and the inline one
   * must not have grown to pay for it - its plot is the plot that shipped.
   */
  it("gives the stacked drawing headroom without moving the inline plot", () => {
    const boxes = [...render().matchAll(/viewBox="0 0 (\d+) (\d+)"/g)].map((m) => Number(m[2]));

    expect(boxes).toHaveLength(2);
    expect(boxes[0]).toBe(302);
    expect(boxes[1]).toBeGreaterThan(boxes[0]);
  });

  it("keeps the rows themselves identical in both drawings", () => {
    const rowXs = (which: "inline" | "stacked") =>
      [...variant(render(), which).matchAll(/<circle class="marker-accent" cx="([\d.]+)"/g)]
        .map((m) => Number(m[1]))
        .slice(0, DESCRIPTORS.length);

    expect(rowXs("stacked")).toEqual(rowXs("inline"));
  });
});
