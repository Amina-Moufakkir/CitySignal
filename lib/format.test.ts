import { describe, expect, test } from "vitest";

import { boroughLabel, showsBrooklynDeepDive } from "./config";
import {
  formatNumber,
  formatPercentage,
  formatSignedPercentage,
  hourLabel,
  possessiveLabel,
} from "./format";

describe("formatters", () => {
  test("formats hours for prose", () => {
    expect(hourLabel(0)).toBe("12 AM");
    expect(hourLabel(11)).toBe("11 AM");
    expect(hourLabel(12)).toBe("12 PM");
    expect(hourLabel(22)).toBe("10 PM");
    expect(hourLabel(23)).toBe("11 PM");
  });

  test("formats borough possessives", () => {
    expect(possessiveLabel("Brooklyn")).toBe("Brooklyn's");
    expect(possessiveLabel("Queens")).toBe("Queens'");
    expect(possessiveLabel("Staten Island")).toBe("Staten Island's");
  });

  test("formats numbers and percentages", () => {
    expect(formatNumber(9944)).toBe("9,944");
    expect(formatNumber(210.5730769, 1)).toBe("210.6");
    expect(formatPercentage(77.83886)).toBe("77.8%");
    expect(formatSignedPercentage(77.83886)).toBe("+77.8%");
    expect(formatSignedPercentage(-12.5)).toBe("-12.5%");
    expect(formatSignedPercentage(0)).toBe("+0.0%");
  });
});

describe("borough labels", () => {
  test("labels every configured borough", () => {
    expect(boroughLabel("BROOKLYN")).toBe("Brooklyn");
    expect(boroughLabel("STATEN ISLAND")).toBe("Staten Island");
    expect(boroughLabel("NOT A BOROUGH")).toBe("Brooklyn");
  });

  test("board normalization is Brooklyn-only", () => {
    expect(showsBrooklynDeepDive("BROOKLYN")).toBe(true);
    expect(showsBrooklynDeepDive("MANHATTAN")).toBe(false);
    expect(showsBrooklynDeepDive("QUEENS")).toBe(false);
    expect(showsBrooklynDeepDive("BRONX")).toBe(false);
    expect(showsBrooklynDeepDive("STATEN ISLAND")).toBe(false);
  });
});
