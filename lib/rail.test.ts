import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The reading navigation's contract.
 *
 * The active section's name is status, so it lives in the top chrome: stable,
 * present for as long as the section is, changing only when the section does.
 * The rail keeps position and links; the eyebrow keeps identity in the article.
 *
 * These read the stylesheet and the component rather than a browser, because
 * what keeps failing is the agreement between the two.
 */
const CSS = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");
const NAV = readFileSync(join(process.cwd(), "components", "ui", "ReadingNav.tsx"), "utf8");

/** The body of the first `@media (...)` block containing `selector`. */
function mediaQueryAround(selector: string): string | null {
  for (const match of CSS.matchAll(/@media ([^{]+)\{/g)) {
    const open = match.index + match[0].length;
    let depth = 1;
    let i = open;

    while (i < CSS.length && depth > 0) {
      if (CSS[i] === "{") depth += 1;
      if (CSS[i] === "}") depth -= 1;
      i += 1;
    }

    if (CSS.slice(open, i).includes(selector)) {
      return match[1].trim();
    }
  }

  return null;
}

function rule(selector: string): string {
  const start = CSS.indexOf(selector);
  expect(start, `selector not found: ${selector}`).toBeGreaterThan(-1);

  const open = CSS.indexOf("{", start);

  return CSS.slice(open + 1, CSS.indexOf("}", open));
}

function remToPx(query: string): number {
  return Number(/([\d.]+)rem/.exec(query)![1]) * 16;
}

describe("active section name in the top chrome", () => {
  it("is part of the fixed top strip, with the progress bar", () => {
    const chrome = rule(".chrome {");

    expect(chrome).toContain("position: fixed");
    // The strip masks the piece scrolling under it rather than sitting on glass.
    expect(chrome).toContain("background: var(--surface)");
    expect(NAV).toMatch(/<div className="chrome">[\s\S]*className="progress"[\s\S]*className="chrome-section"/);
  });

  /**
   * The regression that started this: the name was painted only above 104rem,
   * so an ordinary desktop showed a rail of dots that never said where you were.
   */
  it("appears at every width where the rail appears", () => {
    const railGate = mediaQueryAround(".rail {\n    display: none;");
    const shownGate = mediaQueryAround(".chrome-section {\n    display: flex;");

    expect(railGate).toBe("(max-width: 64rem)");
    expect(shownGate).toBe("(min-width: 64.0625rem)");
    // 104rem survives only on the rail's hover label, which does open across the
    // article and is a deliberate pointer-only affordance. The status name must
    // not be behind it.
    expect(shownGate).not.toContain("104rem");
    expect(mediaQueryAround(".rail a:hover .rail-label")).toBe("(min-width: 104rem)");
  });

  it.each([1100, 1280, 1366, 1440, 1664, 1920])("is shown at %ipx", (width) => {
    expect(width).toBeGreaterThanOrEqual(remToPx(mediaQueryAround(".chrome-section {\n    display: flex;")!));
  });

  it("leaves the mobile layout alone", () => {
    // Hidden by default, revealed only by the desktop query above.
    expect(rule(".chrome-section {")).toContain("display: none");
  });

  /**
   * The name changes sixteen times on the way down. A row that sized itself to
   * its contents would move the whole page each time a longer name arrived.
   */
  it("reserves a fixed row height so the header cannot jump", () => {
    const section = rule(".chrome-section {");

    expect(section).toContain("height: var(--chrome-bar-height)");
    expect(rule(":root {")).toMatch(/--chrome-bar-height:\s*[\d.]+rem/);
  });

  it("keeps long names whole", () => {
    const section = rule(".chrome-section {");

    expect(section).not.toContain("text-overflow");
    expect(section).not.toContain("ellipsis");
  });

  it("uses the piece's own navigation typography", () => {
    const section = rule(".chrome-section {");
    const eyebrow = rule(".eyebrow {");

    for (const property of ["font-family", "font-size", "font-weight", "text-transform"]) {
      const value = (body: string) => new RegExp(`${property}:\\s*([^;]+)`).exec(body)?.[1].trim();

      expect(value(section), property).toBe(value(eyebrow));
    }
  });

  it("is announced once, by the rail rather than twice", () => {
    expect(NAV).toMatch(/<p className="chrome-section" aria-hidden="true">/);
    expect(NAV).toContain('aria-current={section.id === active ? "true" : undefined}');
  });
});

describe("the article pays nothing for the chrome", () => {
  it("reserves no navigation gutter", () => {
    expect(CSS).not.toContain("--rail-gutter");
    expect(CSS).not.toContain("padding-right: var(--rail-gutter)");
  });

  /** Vertical room for a fixed strip is fine. Horizontal room is not. */
  it("moves the article down rather than narrowing it", () => {
    const desktop = mediaQueryAround("padding-top: calc(var(--chrome-bar-height)");

    expect(desktop).toBe("(min-width: 64.0625rem)");
    expect(rule("main {")).toContain("padding: 0 1.5rem");
    expect(rule("article {")).toContain("max-width: var(--measure-wide)");
  });
});

describe("the rail keeps its own job", () => {
  it("stays fixed and vertically centred", () => {
    const rail = rule(".rail {");

    expect(rail).toContain("position: fixed");
    expect(rail).toContain("top: 50%");
    expect(rail).toContain("transform: translateY(-50%)");
  });

  it("still marks the active dot", () => {
    expect(rule(".rail-item-active .rail-dot {")).toContain("background: var(--accent)");
  });

  it("still names a focused link without a second persistent label", () => {
    expect(rule(".rail a:focus-visible .rail-label {")).toContain("opacity: 1");
    // The free-standing marker is gone, so there is nothing to collide with it.
    expect(CSS).not.toContain("rail-marker");
    expect(NAV).not.toContain("rail-marker");
  });
});

describe("nothing is left over from the eyebrow-alignment design", () => {
  /**
   * The name is no longer tied to a heading's position, so everything that
   * existed only to track one is gone: the measured y, the aligned/absent
   * state, the safe region, and the re-measure after the entrance transition.
   */
  it.each([
    "--rail-marker-y",
    "data-aligned",
    "SAFE_INSET",
    "placeMarker",
    "transitionend",
    "eyebrowsRef",
  ])("has no remaining %s", (leftover) => {
    expect(NAV, `${leftover} still in ReadingNav`).not.toContain(leftover);
    expect(CSS, `${leftover} still in globals.css`).not.toContain(leftover);
  });

  it("keeps one observer and no new scroll listener", () => {
    const listeners = [...NAV.matchAll(/addEventListener\("(\w+)"/g)].map((match) => match[1]);
    const observers = [...NAV.matchAll(/new IntersectionObserver/g)];

    expect(listeners.sort()).toEqual(["resize", "scroll"]);
    expect(observers).toHaveLength(1);
  });

  /** The name updates on a section change, not on every frame of a scroll. */
  it("writes nothing to the DOM per scroll frame", () => {
    expect(NAV).not.toContain("setProperty");
    expect(NAV).not.toContain("dataset");
    expect(NAV).toContain("setActiveIndex(current)");
  });
});
