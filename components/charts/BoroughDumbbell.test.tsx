import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BoroughDumbbell } from "./BoroughDumbbell";
import { WEEKDAY_INDEX, type BoroughRow } from "@/lib/citywide";

/**
 * Five boroughs spanning the range the chart has to survive: a large rise, a
 * small one, a fall, a level pair, and a borough with no comparison at all. The
 * small rise is the case the encoding is really about - a connector a few pixels
 * long is still the weekend series.
 */
function row(label: string, weekendIndex: number): BoroughRow {
  const percentageDifference = weekendIndex - WEEKDAY_INDEX;

  return {
    borough: label.toUpperCase() as BoroughRow["borough"],
    label,
    index: {
      kind: "computed",
      weekdayIndex: WEEKDAY_INDEX,
      weekendIndex,
      percentageDifference,
      direction:
        percentageDifference === 0 ? "level" : percentageDifference > 0 ? "higher" : "lower",
    },
    comparison: {
      kind: "computed",
      weekdayAverage: 100,
      weekendAverage: weekendIndex,
      percentageDifference,
      direction:
        percentageDifference === 0 ? "level" : percentageDifference > 0 ? "higher" : "lower",
    },
    weekdayDays: 260,
    weekendDays: 104,
    totalComplaints: 10_000,
  };
}

const ROWS: BoroughRow[] = [
  row("Bronx", 147.7),
  row("Brooklyn", 100.4),
  row("Manhattan", 92.1),
  row("Queens", 100),
  {
    ...row("Staten Island", 100),
    index: { kind: "no-data" },
    comparison: { kind: "no-data" },
  },
];

function render(rows: BoroughRow[] = ROWS) {
  return renderToStaticMarkup(<BoroughDumbbell rows={rows} label="Test period" />);
}

/** Connector classes in document order. */
function connectors(markup: string): string[] {
  return [...markup.matchAll(/<line class="(dumbbell-[a-z]+)"/g)].map((match) => match[1]);
}

describe("BoroughDumbbell series identity", () => {
  /**
   * The legend defines a filled orange mark as the weekend. The connector is the
   * weekend's distance from its own baseline, so it is part of that series: a
   * grey connector said the difference belonged to the weekday side, or to
   * nothing.
   */
  it("draws every borough connector with the weekend accent", () => {
    const drawn = connectors(render());

    // One per borough with a comparison; Staten Island has none, so no connector.
    expect(drawn).toHaveLength(4);
    expect(new Set(drawn)).toEqual(new Set(["dumbbell-accent"]));
  });

  it("never falls back to the muted connector, however small the difference", () => {
    const markup = render();

    expect(markup).not.toContain("dumbbell-muted");
    // Brooklyn is +0.4 and Queens is level: the two shortest connectors there
    // are, and the two a length-sensitive encoding would quietly drop.
    expect(markup).toContain("no difference");
  });

  it("holds when every borough is level", () => {
    const drawn = connectors(render([row("Bronx", 100), row("Brooklyn", 100)]));

    expect(drawn).toHaveLength(2);
    expect(new Set(drawn)).toEqual(new Set(["dumbbell-accent"]));
  });

  it("holds when a borough falls below its baseline", () => {
    const drawn = connectors(render([row("Manhattan", 61.4)]));

    expect(drawn).toEqual(["dumbbell-accent"]);
  });

  /**
   * The markers keep their two meanings. Identity is not carried by colour alone
   * anywhere in this piece, and here the pairing is hollow-grey baseline against
   * filled-orange weekend, one of each per row plus the legend's two.
   */
  it("keeps the baseline mark muted and the weekend mark accented", () => {
    const markup = render();
    const marks = [...markup.matchAll(/<circle class="(marker-[a-z]+)"/g)].map((match) => match[1]);

    expect(marks.filter((mark) => mark === "marker-muted")).toHaveLength(5);
    expect(marks.filter((mark) => mark === "marker-accent")).toHaveLength(5);
  });

  it("draws no connector for a borough with no comparison", () => {
    const markup = render([ROWS[4]]);

    expect(connectors(markup)).toHaveLength(0);
    expect(markup).toContain("No data returned for this period");
  });
});
