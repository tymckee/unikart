import { describe, it, expect } from "vitest";
import {
  normalizeUnit,
  toInches,
  toCentimeters,
  fmtNum,
  formatMeasure,
  secondaryMeasure,
} from "./units";

describe("normalizeUnit", () => {
  it("maps common unit spellings", () => {
    expect(normalizeUnit('"')).toBe("in");
    expect(normalizeUnit("inches")).toBe("in");
    expect(normalizeUnit("IN")).toBe("in");
    expect(normalizeUnit("cm")).toBe("cm");
    expect(normalizeUnit("centimeters")).toBe("cm");
    expect(normalizeUnit("'")).toBe("ft");
    expect(normalizeUnit("feet")).toBe("ft");
    expect(normalizeUnit("mm")).toBe("mm");
    expect(normalizeUnit("m")).toBe("m");
  });
  it("rejects non-length units", () => {
    expect(normalizeUnit("qt")).toBe(null);
    expect(normalizeUnit("L")).toBe(null);
    expect(normalizeUnit("oz")).toBe(null);
  });
});

describe("conversions", () => {
  it("converts to inches / centimeters", () => {
    expect(toInches({ value: 2.54, unit: "cm" })).toBeCloseTo(1);
    expect(toCentimeters({ value: 1, unit: "in" })).toBeCloseTo(2.54);
    expect(toInches({ value: 1, unit: "ft" })).toBeCloseTo(12);
  });
});

describe("formatting", () => {
  it("trims trailing zeros", () => {
    expect(fmtNum(18.5)).toBe("18.5");
    expect(fmtNum(27)).toBe("27");
    expect(fmtNum(18.0)).toBe("18");
  });
  it("formats a measure in its own unit", () => {
    expect(formatMeasure({ value: 18.5, unit: "in" })).toBe("18.5 in");
    expect(formatMeasure({ value: 120, unit: "cm" })).toBe("120 cm");
  });
  it("gives a complementary imperial/metric reading", () => {
    expect(secondaryMeasure({ value: 27, unit: "in" })).toBe("68.6 cm");
    expect(secondaryMeasure({ value: 84, unit: "in" })).toBe("2.13 m");
    expect(secondaryMeasure({ value: 120, unit: "cm" })).toBe("47.2 in");
  });
});
