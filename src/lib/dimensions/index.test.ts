import { describe, it, expect } from "vitest";
import { deriveDimensions } from "./index";

describe("deriveDimensions — full furniture", () => {
  it("chair from a description triple (headline = height, to scale)", () => {
    const m = deriveDimensions({
      title: "Herman Miller Aeron Chair",
      category: "Office",
      description: 'Ergonomic office chair. Dimensions: 27"W x 18.5"D x 41"H.',
    });
    expect(m).toMatchObject({
      shape: "chair",
      plane: "elevation",
      width: { value: 27, unit: "in" },
      depth: { value: 18.5, unit: "in" },
      height: { value: 41, unit: "in" },
      headline: "height",
      toScale: true,
    });
  });

  it("sofa from a gist spec triple (headline = width)", () => {
    const m = deriveDimensions({
      title: "West Elm Andes 3-Seater Sofa",
      category: "Home",
      specs: [{ label: "Dimensions", value: "84 x 38 x 36 in" }],
    });
    expect(m).toMatchObject({
      shape: "sofa",
      width: { value: 84, unit: "in" },
      depth: { value: 38, unit: "in" },
      height: { value: 36, unit: "in" },
      headline: "width",
      toScale: true,
    });
  });

  it("desk L×W×H maps L→width, W→depth", () => {
    const m = deriveDimensions({
      title: "Uplift Standing Desk",
      category: "Office",
      description: 'Desk surface 60"L x 30"W x 29"H.',
    });
    expect(m?.width).toEqual({ value: 60, unit: "in" });
    expect(m?.depth).toEqual({ value: 30, unit: "in" });
    expect(m?.height).toEqual({ value: 29, unit: "in" });
  });
});

describe("deriveDimensions — footprints, round, screens", () => {
  it("rug as a footprint (width × depth)", () => {
    const m = deriveDimensions({
      title: "Ruggable Washable Area Rug",
      category: "Home",
      description: "Washable area rug, 60 x 96 in.",
    });
    expect(m).toMatchObject({
      shape: "rug",
      plane: "footprint",
      width: { value: 60, unit: "in" },
      depth: { value: 96, unit: "in" },
      toScale: true,
    });
    expect(m?.height).toBeUndefined();
  });

  it("tv from a diagonal alone", () => {
    const m = deriveDimensions({
      title: "LG C4 65-inch OLED evo TV",
      category: "Home",
    });
    expect(m).toMatchObject({
      shape: "tv",
      diagonal: { value: 65, unit: "in" },
      headline: "diagonal",
      toScale: true,
    });
  });

  it("box fallback only when a full W×D×H triple exists", () => {
    const m = deriveDimensions({
      title: "Sterilite Storage Bin",
      category: "Home",
      description: "Stackable bin, 24 x 16 x 12 in.",
    });
    expect(m).toMatchObject({ shape: "box", headline: "width", toScale: true });
  });
});

describe("deriveDimensions — single axis is honest, not faked", () => {
  it("a lone height draws the shape with toScale=false", () => {
    const m = deriveDimensions({
      title: "Brightech Floor Lamp",
      category: "Home",
      specs: [{ label: "Height", value: "58 in" }],
    });
    expect(m).toMatchObject({
      shape: "lamp",
      height: { value: 58, unit: "in" },
      headline: "height",
      toScale: false,
    });
    expect(m?.width).toBeUndefined();
  });
});

describe("deriveDimensions — returns null rather than invent", () => {
  it("apparel never gets a silhouette", () => {
    expect(
      deriveDimensions({
        title: "Patagonia Better Sweater Fleece Jacket",
        category: "Apparel",
        description: "Warm knit fleece, 28 x 24 in laid flat.",
      }),
    ).toBe(null);
  });
  it("no dimensions, no draw", () => {
    expect(
      deriveDimensions({
        title: "AirPods Max — USB-C",
        category: "Headphones",
        description: "Over-ear headphones with active noise cancellation.",
      }),
    ).toBe(null);
  });
  it("a stray two-number phrase with no known shape draws nothing", () => {
    expect(
      deriveDimensions({
        title: "Mystery Thing",
        category: "Home",
        description: "Comes as a pack of 5 x 7 cards.",
      }),
    ).toBe(null);
  });
  it("does not fabricate a size from bare prose numbers (P1)", () => {
    expect(
      deriveDimensions({
        title: "Heavy-Duty Storage Rack",
        category: "Home",
        description: "Holds 2 x 4 lumber and bulk bins.",
      }),
    ).toBe(null);
  });
  it("does not read 'across' prose as a round footprint (P2)", () => {
    expect(
      deriveDimensions({
        title: "Hand-Knotted Area Rug",
        category: "Home",
        description: "Spans 30 in across the room.",
      }),
    ).toBe(null);
  });
});

describe("deriveDimensions — to-scale claim is honest at extremes", () => {
  it("drops the to-scale claim for a degenerate aspect ratio (svg-1)", () => {
    const m = deriveDimensions({
      title: "Hallway Runner Rug",
      category: "Home",
      description: "Runner rug, 144 x 2 in.",
    });
    expect(m).toMatchObject({ shape: "rug", toScale: false });
    expect(m?.width).toEqual({ value: 144, unit: "in" });
    expect(m?.depth).toEqual({ value: 2, unit: "in" });
  });
});
