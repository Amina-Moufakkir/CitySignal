import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BoardBars } from "./BoardBars";
import { buildBoardRates } from "@/lib/analysis";
import { BROOKLYN_BOARD_LABELS, boardLabel } from "@/lib/board-labels";

/**
 * Rendered from the committed extract rather than a fixture, so the ordering and
 * the rates asserted here are the ones the page draws.
 */
const BOARDS = buildBoardRates();
const HIGHLIGHT = BOARDS[0].board;

function render(highlight = HIGHLIGHT) {
  return renderToStaticMarkup(<BoardBars boards={BOARDS} highlight={highlight} />);
}

/** The measure, written out. Anything shorter names a different denominator. */
const MEASURE = "complaints per 1,000 occupied households";

describe("BoardBars denominator wording", () => {
  it("uses the full measure on every surface, visible and accessible", () => {
    const markup = render();

    // The axis caption in the wide form, the two-line caption in the narrow
    // form, the table column, the table summary and the SVG description.
    expect(markup).toContain(MEASURE);
    expect(markup).toContain("Complaints per 1,000 occupied households");
    expect(markup).toContain("complaints per 1,000</tspan>");
    expect(markup).toContain("occupied households</tspan>");
  });

  it("carries the measure in both charts' accessible names", () => {
    const labels = [...render().matchAll(/aria-label="([^"]+)"/g)].map((match) => match[1]);

    expect(labels).toHaveLength(2);
    for (const label of labels) {
      expect(label).toContain(MEASURE);
    }
  });

  /**
   * "per 1,000 households" is a different quantity from "per 1,000 occupied
   * households" - occupied is the ACS denominator this chart divides by. The
   * shorthand was in the visible caption and the table column and must not
   * come back.
   */
  it("has no bare per-1,000-households shorthand left anywhere", () => {
    const markup = render();

    expect(markup).not.toMatch(/(?<!occupied )per 1,000 households/i);
    expect(markup).not.toContain("Per 1,000 households");
  });
});

describe("BoardBars district labels", () => {
  it("resolves every rendered row to a label", () => {
    for (const board of BOARDS) {
      expect(boardLabel(board.board), `no label for ${board.board}`).not.toBeNull();
    }
  });

  it("draws eighteen row labels in each of the two forms", () => {
    const rows = [...render().matchAll(/class="tick row-label board-row-label/g)];

    expect(rows).toHaveLength(BOARDS.length * 2);
  });

  it("keeps the code alongside the name in every visible label", () => {
    const markup = render();

    for (const label of BROOKLYN_BOARD_LABELS) {
      // Wide form: one line. Narrow form: the code on its own line, the name
      // under it. Either way the code is drawn.
      expect(markup, `${label.board} concise`).toContain(`${label.board} · ${label.name}`);
      expect(markup, `${label.board} stacked`).toContain(`>${label.board}</tspan>`);
      expect(markup, `${label.board} name`).toContain(`>${label.name}</tspan>`);
    }
  });

  it("names BK04 as Bushwick", () => {
    const markup = render();

    expect(markup).toContain("BK04 · Bushwick");
    expect(markup).toContain("BK04 Bushwick (CD 4 Equivalent)");
  });

  /**
   * The table twin is where the complete DCP name lives, equivalence status
   * included. Dropping the status would quietly upgrade an approximation into a
   * boundary.
   */
  it("gives the table the complete official name and status for every board", () => {
    const markup = render();

    for (const label of BROOKLYN_BOARD_LABELS) {
      expect(markup, label.board).toContain(label.officialName);
      expect(label.officialName).toMatch(/\(CD \d+ (?:Equivalent|Approximation)\)$/);
    }
  });

  it("keeps the CDTA caveat with the names", () => {
    const markup = render();

    expect(markup).toContain("approximates a community district");
    expect(markup).toContain("not an exact neighbourhood boundary");
  });

  it("names no joint interest area", () => {
    const markup = render();

    expect(markup).not.toContain("BK55");
    expect(markup).not.toContain("BK56");
    expect(markup).not.toContain("Prospect Park");
    expect(markup).not.toContain("Jamaica Bay");
  });
});

describe("BoardBars analytical content", () => {
  /**
   * The labelling pass must not have touched a number or an order. These are the
   * committed extract's own values, recomputed by `buildBoardRates`.
   */
  it("draws the boards in descending rate order", () => {
    const rates = BOARDS.map((board) => board.complaintsPer1000Households);

    expect(rates).toEqual([...rates].sort((a, b) => b - a));
    expect(BOARDS).toHaveLength(18);
  });

  it("keeps BK04 highest at 30.6 and BK15 lowest at 4.4", () => {
    expect(BOARDS[0].board).toBe("BK04");
    expect(BOARDS[0].complaintsPer1000Households).toBeCloseTo(30.6, 1);
    expect(BOARDS[BOARDS.length - 1].board).toBe("BK15");
    expect(BOARDS[BOARDS.length - 1].complaintsPer1000Households).toBeCloseTo(4.4, 1);
  });

  it("accents the highlighted board and no other, in both forms", () => {
    const markup = render();

    expect([...markup.matchAll(/class="mark-accent"/g)]).toHaveLength(2);
    expect([...markup.matchAll(/class="mark-muted"/g)]).toHaveLength((BOARDS.length - 1) * 2);
  });

  it("moves the accent with the highlight rather than fixing it to the leader", () => {
    const accented = render("BK17")
      .split("<g>")
      .filter((group) => group.includes("mark-accent"));

    // One row group per form, and both of them BK17's.
    expect(accented).toHaveLength(2);
    for (const group of accented) {
      expect(group).toContain("BK17");
      expect(group).not.toContain("BK04");
    }
  });

  it("prints a value for the leaders and leaves the rest to the table", () => {
    const values = [...render().matchAll(/class="value-label[^"]*"/g)];

    // Three per form: the highlight is the leader here, so it is one of them.
    expect(values).toHaveLength(6);
  });

  it("puts all eighteen rates in the table twin regardless", () => {
    const markup = render();

    for (const board of BOARDS) {
      expect(markup).toContain(board.complaintsPer1000Households.toFixed(1));
    }
  });
});

describe("BoardBars responsive forms", () => {
  /**
   * A viewBox is an attribute, so the narrow geometry cannot be a media query on
   * the wide one. Both are rendered and a container query shows one; if that ever
   * collapses to a single form, the narrow end loses either its legibility or its
   * names.
   */
  it("renders both a wide and a narrow geometry", () => {
    const markup = render();

    expect(markup).toContain("board-bars-wide");
    expect(markup).toContain("board-bars-compact");
    expect([...markup.matchAll(/<svg/g)]).toHaveLength(2);
  });

  it("gives the narrow form a taller row pitch and a narrower drawing", () => {
    const boxes = [...render().matchAll(/viewBox="0 0 (\d+) (\d+)"/g)].map((match) => ({
      width: Number(match[1]),
      height: Number(match[2]),
    }));

    expect(boxes).toHaveLength(2);
    const [wide, compact] = boxes;

    expect(compact.width).toBeLessThan(wide.width);
    // Taller per row, which is what buys the second label line.
    expect(compact.height / compact.width).toBeGreaterThan(wide.height / wide.width);
  });

  it("stacks the code over the name only in the narrow form", () => {
    const markup = render();
    const rowLabels = (slice: string) =>
      [...slice.matchAll(/<text class="tick row-label board-row-label[^"]*"[^>]*>(.*?)<\/text>/g)].map(
        (match) => match[1],
      );

    const wide = rowLabels(markup.slice(markup.indexOf("board-bars-wide"), markup.indexOf("board-bars-compact")));
    const compact = rowLabels(markup.slice(markup.indexOf("board-bars-compact")));

    expect(wide).toHaveLength(18);
    expect(compact).toHaveLength(18);

    for (const label of wide) {
      expect(label).not.toContain("<tspan");
      expect(label).toContain(" · ");
    }

    for (const label of compact) {
      // Two lines, and the code is the one that leads.
      expect([...label.matchAll(/<tspan/g)]).toHaveLength(2);
      expect(label).toMatch(/^<tspan[^>]*>BK\d\d<\/tspan>/);
    }
  });
});
