import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { SECTIONS, nextSection, sectionMeta } from "./sections";

const README = readFileSync(new URL("../README.md", import.meta.url), "utf8");

describe("running order", () => {
  it("has unique ids", () => {
    const ids = SECTIONS.map((section) => section.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("opens on the reframe and closes on the boundaries", () => {
    expect(SECTIONS[0].id).toBe("hook");
    expect(SECTIONS[SECTIONS.length - 1].id).toBe("boundaries");
  });

  /**
   * The citywide layer has to come before the case study, because the whole
   * point of the restructure is that a reader meets New York before Brooklyn.
   */
  it("puts the citywide layer ahead of the Brooklyn case study", () => {
    const order: string[] = SECTIONS.map((section) => section.id);
    const cityEnd = order.indexOf("casestudy");

    for (const id of ["guess", "citywide", "borough"]) {
      expect(order.indexOf(id)).toBeLessThan(cityEnd);
    }

    for (const id of ["corpus", "rhythm", "reveal", "where", "persistence", "failed"]) {
      expect(order.indexOf(id)).toBeGreaterThan(cityEnd);
    }
  });

  it("asks for the guess before showing the answer", () => {
    const order: string[] = SECTIONS.map((section) => section.id);

    expect(order.indexOf("guess")).toBeLessThan(order.indexOf("citywide"));
  });

  it("keeps evidence ahead of the findings that rest on it", () => {
    const order: string[] = SECTIONS.map((section) => section.id);

    expect(order.indexOf("reveal")).toBeLessThan(order.indexOf("nights"));
    expect(order.indexOf("saturday")).toBeLessThan(order.indexOf("parties"));
    expect(order.indexOf("where")).toBeLessThan(order.indexOf("failed"));
    expect(order.indexOf("failed")).toBeLessThan(order.indexOf("boundaries"));
  });

  it("no longer carries a trailing explore section", () => {
    expect(SECTIONS.map((section) => String(section.id))).not.toContain("explore");
  });

  it("links every section to the next one, and stops", () => {
    for (let index = 0; index < SECTIONS.length - 1; index += 1) {
      expect(nextSection(SECTIONS[index].id)?.id).toBe(SECTIONS[index + 1].id);
    }

    expect(nextSection(SECTIONS[SECTIONS.length - 1].id)).toBeNull();
  });

  it("throws rather than guessing for an unknown section", () => {
    // @ts-expect-error - the point is the runtime guard behind the type
    expect(() => sectionMeta("nope")).toThrow();
  });
});

/**
 * The README's table drifted from the running order twice before, once by three
 * sections. It is documentation of a list that exists in code, so the two are
 * compared rather than trusted.
 */
describe("documentation agrees with the running order", () => {
  it("states the right number of sections", () => {
    const words = [
      "",
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
      "ten",
      "eleven",
      "twelve",
      "thirteen",
      "fourteen",
      "fifteen",
      "sixteen",
      "seventeen",
      "eighteen",
    ];

    expect(README).toContain(`${words[SECTIONS.length]} sections`);
  });

  it("lists every section in order, and no others", () => {
    const rows = [...README.matchAll(/^\| (\d+) \| ([^|]+?) \| /gm)];

    expect(rows).toHaveLength(SECTIONS.length);
    rows.forEach((match, index) => {
      expect(Number(match[1])).toBe(index + 1);
    });
  });
});
