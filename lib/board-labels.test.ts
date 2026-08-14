import { describe, expect, it } from "vitest";

import {
  BOARD_LABEL_SOURCE,
  BROOKLYN_BOARD_LABELS,
  boardDisplayName,
  boardFullName,
  boardLabel,
} from "./board-labels";
import { PHASE3_BOARD_DATASET } from "./static-data";

describe("Brooklyn board labels", () => {
  it("covers every board in the committed dataset", () => {
    for (const row of PHASE3_BOARD_DATASET.rows) {
      expect(boardLabel(row.board), `missing label for ${row.board}`).not.toBeNull();
    }
  });

  it("has no board the dataset does not contain", () => {
    const known = new Set(PHASE3_BOARD_DATASET.rows.map((row) => row.board));

    for (const label of BROOKLYN_BOARD_LABELS) {
      expect(known.has(label.board), `${label.board} is not in the dataset`).toBe(true);
    }
  });

  it("covers all eighteen Brooklyn community districts", () => {
    expect(BROOKLYN_BOARD_LABELS).toHaveLength(18);
    expect(PHASE3_BOARD_DATASET.rows).toHaveLength(18);
  });

  it("has no duplicate codes", () => {
    const codes = BROOKLYN_BOARD_LABELS.map((label) => label.board);

    expect(new Set(codes).size).toBe(codes.length);
  });

  it("uses the BK01..BK18 codes with no gaps", () => {
    const expected = Array.from({ length: 18 }, (_unused, index) => `BK${String(index + 1).padStart(2, "0")}`);

    expect(BROOKLYN_BOARD_LABELS.map((label) => label.board).sort()).toEqual(expected);
  });

  it("carries a non-empty name for every board", () => {
    for (const label of BROOKLYN_BOARD_LABELS) {
      expect(label.name.length).toBeGreaterThan(0);
      expect(label.name).not.toContain("CD ");
    }
  });

  /**
   * The Equivalent/Approximation flag is DCP's own statement of how closely the
   * tabulation area matches the legal district. It is the CDTA caveat, so losing
   * it would quietly upgrade an approximation into a boundary.
   */
  it("keeps DCP's equivalence status for every board", () => {
    for (const label of BROOKLYN_BOARD_LABELS) {
      expect(["equivalent", "approximation"]).toContain(label.status);
    }
  });

  it("keeps the complete official name, status included", () => {
    for (const label of BROOKLYN_BOARD_LABELS) {
      expect(label.officialName).toContain(label.board);
      expect(label.officialName).toContain(label.name);
      expect(label.officialName).toMatch(/\((?:CD \d+) (?:Equivalent|Approximation)\)$/);
      expect(label.officialName.toLowerCase()).toContain(label.status);
    }
  });

  it("formats the concise label as code, separator, name", () => {
    expect(boardDisplayName("BK04")).toBe("BK04 · Bushwick");
    expect(boardDisplayName("BK02")).toBe("BK02 · Downtown Brooklyn-Fort Greene");
  });

  it("preserves multi-area names rather than reducing them to one", () => {
    expect(boardDisplayName("BK05")).toContain("East New York-Cypress Hills");
    expect(boardDisplayName("BK15")).toContain("Sheepshead Bay-Gravesend (East)");
  });

  it("returns the full official name for the table twin", () => {
    expect(boardFullName("BK04")).toBe("BK04 Bushwick (CD 4 Equivalent)");
  });

  it("falls back to the bare code rather than inventing a name", () => {
    expect(boardDisplayName("BK99")).toBe("BK99");
    expect(boardFullName("BK99")).toBe("BK99");
    expect(boardLabel("BK99")).toBeNull();
  });

  it("records where the names came from", () => {
    expect(BOARD_LABEL_SOURCE.datasetId).toBe("xn3r-zk6y");
    expect(BOARD_LABEL_SOURCE.filter).toContain("cdtatype = '0'");
    expect(BOARD_LABEL_SOURCE.publisher).toContain("City Planning");
  });

  /**
   * The same query returns BK55 Prospect Park and BK56 Jamaica Bay as Joint
   * Interest Areas. They are not community districts and must never appear here.
   */
  it("excludes the joint interest areas", () => {
    const codes = BROOKLYN_BOARD_LABELS.map((label) => label.board);

    expect(codes).not.toContain("BK55");
    expect(codes).not.toContain("BK56");
  });
});
