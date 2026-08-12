import { describe, expect, test } from "vitest";
import { niceMax } from "../components/charts/ChartFrame";
describe("niceMax", () => {
  test("sits just above the data instead of far above it", () => {
    expect(niceMax(656)).toBe(700);   // corpus calendar
    expect(niceMax(44.7)).toBe(50);   // hourly chart
    expect(niceMax(374.5)).toBe(400); // day-type columns
    expect(niceMax(238.3)).toBe(250); // night bars
    expect(niceMax(30.6)).toBe(40);   // board bars
  });
  test("never crops the data", () => {
    for (const v of [1, 3.2, 9.9, 47, 101, 656, 999, 1001, 44.7]) {
      expect(niceMax(v), String(v)).toBeGreaterThanOrEqual(v);
    }
  });
  test("handles empty and zero input", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(-5)).toBe(1);
  });
});
