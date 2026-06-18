import { describe, it, expect } from "vitest";
import {
  numFromToken,
  extractDimensionPhrase,
  extractDiagonal,
  parseAxisSpec,
} from "./parse";

describe("numFromToken", () => {
  it("parses decimals, fractions, and mixed numbers", () => {
    expect(numFromToken("18.5")).toBe(18.5);
    expect(numFromToken("12")).toBe(12);
    expect(numFromToken("1/2")).toBe(0.5);
    expect(numFromToken("18 1/2")).toBe(18.5);
    expect(numFromToken("18-1/2")).toBe(18.5);
  });
});

describe("extractDimensionPhrase — labelled axes", () => {
  it("reads W/D/H with attached inch marks", () => {
    const p = extractDimensionPhrase('27"W x 18.5"D x 41"H');
    expect(p?.labeled).toEqual({
      W: { value: 27, unit: "in" },
      D: { value: 18.5, unit: "in" },
      H: { value: 41, unit: "in" },
    });
  });
  it("reads an L x W x H phrase", () => {
    const p = extractDimensionPhrase('60"L x 30"W x 29"H');
    expect(p?.labeled).toEqual({
      L: { value: 60, unit: "in" },
      W: { value: 30, unit: "in" },
      H: { value: 29, unit: "in" },
    });
  });
});

describe("extractDimensionPhrase — unlabelled triples", () => {
  it("applies a trailing unit to all three", () => {
    expect(extractDimensionPhrase("84 x 38 x 36 inches")?.ordered).toEqual([
      { value: 84, unit: "in" },
      { value: 38, unit: "in" },
      { value: 36, unit: "in" },
    ]);
  });
  it("reads metric and a 'Dimensions:' prefix", () => {
    expect(extractDimensionPhrase("120 x 80 x 75 cm")?.ordered).toEqual([
      { value: 120, unit: "cm" },
      { value: 80, unit: "cm" },
      { value: 75, unit: "cm" },
    ]);
    expect(
      extractDimensionPhrase("Product Dimensions: 54.3 x 21.7 x 33.5 in")
        ?.ordered,
    ).toEqual([
      { value: 54.3, unit: "in" },
      { value: 21.7, unit: "in" },
      { value: 33.5, unit: "in" },
    ]);
  });
  it("handles fractions and 'by' as a separator", () => {
    expect(extractDimensionPhrase("18 1/2 x 12 x 30 in")?.ordered).toEqual([
      { value: 18.5, unit: "in" },
      { value: 12, unit: "in" },
      { value: 30, unit: "in" },
    ]);
    expect(extractDimensionPhrase("84 by 38 by 36 in")?.ordered?.length).toBe(3);
  });
});

describe("extractDimensionPhrase — doubles and round", () => {
  it("reads a two-axis footprint", () => {
    expect(extractDimensionPhrase("5 x 7 ft")?.ordered).toEqual([
      { value: 5, unit: "ft" },
      { value: 7, unit: "ft" },
    ]);
  });
  it("reads a diameter", () => {
    expect(extractDimensionPhrase("Ø 48 in")?.diameter).toEqual({
      value: 48,
      unit: "in",
    });
    expect(extractDimensionPhrase('48" diameter')?.diameter).toEqual({
      value: 48,
      unit: "in",
    });
  });
});

describe("extractDimensionPhrase — false positives stay out", () => {
  it("ignores resolutions, capacities, battery life, screen size, and prose", () => {
    expect(extractDimensionPhrase("3840 x 2160")).toBe(null);
    expect(extractDimensionPhrase("1920 x 1080 resolution")).toBe(null);
    expect(extractDimensionPhrase("Expandable 45L carry-on")).toBe(null);
    expect(extractDimensionPhrase("30-hour battery and multipoint")).toBe(null);
    expect(extractDimensionPhrase("6.8-inch glare-free display")).toBe(null);
    expect(extractDimensionPhrase("Industry-leading noise cancellation")).toBe(
      null,
    );
  });
  it("never fabricates inches from a bare unitless prose pair", () => {
    // No unit token and no axis letters → not a trustworthy dimension.
    expect(extractDimensionPhrase("Holds 2 x 4 lumber")).toBe(null);
    expect(extractDimensionPhrase("Great in a 2 x 4 nook")).toBe(null);
    expect(extractDimensionPhrase("Anchors a 3 x 5 rug")).toBe(null);
    expect(extractDimensionPhrase("Pairs with an 8 x 3.5 GHz build")).toBe(null);
  });
  it("does not read 'across' prose as a diameter", () => {
    expect(extractDimensionPhrase("Spans 30 in across the room")).toBe(null);
    expect(extractDimensionPhrase("Sits 24 in across from the wall")).toBe(null);
  });
});

describe("extractDimensionPhrase — malformed axis letters fall back to positional", () => {
  it("a repeated axis letter does not drop an extent", () => {
    expect(extractDimensionPhrase("30W x 40W x 50H")?.ordered).toEqual([
      { value: 30, unit: "in" },
      { value: 40, unit: "in" },
      { value: 50, unit: "in" },
    ]);
  });
});

describe("parseAxisSpec — single labelled axis from a spec row", () => {
  it("reads a trustworthy overall axis", () => {
    expect(parseAxisSpec("Height", "41 in")).toEqual({
      axis: "height",
      measure: { value: 41, unit: "in" },
    });
    expect(parseAxisSpec("Overall Width", "27 in")).toEqual({
      axis: "width",
      measure: { value: 27, unit: "in" },
    });
    expect(parseAxisSpec("Diameter", "48 cm")).toEqual({
      axis: "diameter",
      measure: { value: 48, unit: "cm" },
    });
  });
  it("rejects partial heights, ranges, and non-dimensions", () => {
    expect(parseAxisSpec("Seat height", "18 in")).toBe(null);
    expect(parseAxisSpec("Height", "16-21 in")).toBe(null);
    expect(parseAxisSpec("Material", "recycled wool")).toBe(null);
    expect(parseAxisSpec("Battery", "30 hours")).toBe(null);
  });
  it("rejects a non-length unit instead of assuming inches", () => {
    expect(parseAxisSpec("Width", "85 px")).toBe(null);
    expect(parseAxisSpec("Length", "60 lb")).toBe(null);
    expect(parseAxisSpec("Width", "15 kg")).toBe(null);
    expect(parseAxisSpec("Width", "85 px thumbnail")).toBe(null);
  });
  it("combines feet+inches instead of truncating to the feet", () => {
    expect(parseAxisSpec("Height", "6 ft 2 in")).toEqual({
      axis: "height",
      measure: { value: 74, unit: "in" },
    });
    expect(parseAxisSpec("Height", `5'6"`)).toEqual({
      axis: "height",
      measure: { value: 66, unit: "in" },
    });
  });
});

describe("extractDiagonal — screen sizes (shape-gated by caller)", () => {
  it("reads a TV/monitor diagonal", () => {
    expect(extractDiagonal("LG C4 65-inch OLED evo")).toEqual({
      value: 65,
      unit: "in",
    });
    expect(extractDiagonal('Dell UltraSharp 27" Monitor')).toEqual({
      value: 27,
      unit: "in",
    });
  });
  it("ignores e-reader screens and absurd values", () => {
    expect(extractDiagonal("6.8-inch glare-free display")).toBe(null);
    expect(extractDiagonal("holds 200 inch of cable")).toBe(null);
  });
});
