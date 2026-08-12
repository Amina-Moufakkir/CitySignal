import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

/**
 * Validates `app/globals.css`.
 *
 * The dark palette is declared twice - once under the OS preference and once
 * under an explicit `data-theme="dark"` - because CSS cannot share a declaration
 * block between a media query and a plain selector. Two copies of anything drift,
 * so this compares them token by token.
 */
const CSS = readFileSync(join(process.cwd(), "app", "globals.css"), "utf8");

function declarationsIn(selector: string): Record<string, string> {
  const start = CSS.indexOf(selector);
  expect(start, `selector not found: ${selector}`).toBeGreaterThan(-1);

  const open = CSS.indexOf("{", start);
  const close = CSS.indexOf("}", open);
  const body = CSS.slice(open + 1, close);
  const declarations: Record<string, string> = {};

  for (const line of body.split(";")) {
    const [property, ...rest] = line.split(":");
    const name = property.trim();

    if (name.length > 0 && rest.length > 0) {
      declarations[name] = rest.join(":").trim();
    }
  }

  return declarations;
}

describe("theme palette", () => {
  const systemDark = declarationsIn(':root:not([data-theme="light"])');
  const explicitDark = declarationsIn(':root[data-theme="dark"]');
  const light = declarationsIn(":root {");

  test("both dark scopes declare exactly the same values", () => {
    expect(explicitDark).toEqual(systemDark);
  });

  test("the dark scopes cover every colour the light scope defines", () => {
    // Colours are identified by their value, not by a list of names to skip.
    // A denylist silently stops covering anything added later - it missed a new
    // layout token the first time this ran.
    const isColour = (value: string) => /^(#|rgba?\(|hsla?\()/.test(value);
    const themed = Object.entries(light)
      .filter(([name, value]) => name.startsWith("--") && isColour(value))
      .map(([name]) => name);

    expect(themed.length).toBeGreaterThan(5);

    for (const token of themed) {
      expect(Object.keys(explicitDark), token).toContain(token);
    }
  });

  test("each scope sets color-scheme so form controls and scrollbars follow", () => {
    expect(light["color-scheme"]).toBe("light");
    expect(systemDark["color-scheme"]).toBe("dark");
    expect(explicitDark["color-scheme"]).toBe("dark");
  });

  // An explicit choice has to beat the OS setting in both directions.
  test("an explicit light choice opts out of the system-dark block", () => {
    expect(CSS).toContain(':root:not([data-theme="light"])');
  });

  test("the accent and de-emphasis pair are the validated values", () => {
    expect(light["--accent"]).toBe("#c2410c");
    expect(light["--de-emphasis"]).toBe("#7d7a74");
    expect(light["--surface"]).toBe("#fbfaf7");
    expect(explicitDark["--accent"]).toBe("#e2703a");
    expect(explicitDark["--de-emphasis"]).toBe("#9aa3ad");
    expect(explicitDark["--surface"]).toBe("#121417");
  });
});
