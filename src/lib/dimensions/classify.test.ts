import { describe, it, expect } from "vitest";
import { classifyShape } from "./classify";

describe("classifyShape — furniture & screens", () => {
  const cases: [string, string, string][] = [
    ["Herman Miller Aeron Chair", "Office", "chair"],
    ["West Elm Andes 3-Seater Sofa", "Home", "sofa"],
    ["IKEA LACK Coffee Table", "Home", "table"],
    ["Uplift V2 Standing Desk 60x30", "Office", "desk"],
    ["Zinus Platform Bed Frame, Queen", "Home", "bed"],
    ["Billy Bookcase, White", "Home", "shelf"],
    ["Malm 6-Drawer Dresser", "Home", "dresser"],
    ["Hemnes Bedside Table, Black-Brown", "Home", "nightstand"],
    ["Ruggable Washable Area Rug 5x7", "Home", "rug"],
    ["Anglepoise Type 75 Desk Lamp", "Office", "lamp"],
    ["LG C4 65-inch OLED evo TV", "Home", "tv"],
    ["Dell UltraSharp 27 Monitor", "Office", "tv"],
  ];
  it.each(cases)("%s → %s", (title, category, shape) => {
    const r = classifyShape(title, category);
    expect(r.shape).toBe(shape);
    expect(r.isApparel).toBe(false);
  });

  it("prefers the most specific keyword", () => {
    expect(classifyShape("Desk Lamp", "Office").shape).toBe("lamp");
    expect(classifyShape("Bedside Table", "Home").shape).toBe("nightstand");
    expect(classifyShape("Office Chair", "Office").shape).toBe("chair");
  });
});

describe("classifyShape — apparel short-circuits to no-draw", () => {
  it("flags garments by keyword and by category", () => {
    expect(classifyShape("Patagonia Better Sweater Fleece Jacket", "Apparel"))
      .toEqual({ shape: null, isApparel: true });
    expect(classifyShape("Allbirds Wool Runners", "Footwear")).toEqual({
      shape: null,
      isApparel: true,
    });
  });
});

describe("classifyShape — no confident silhouette", () => {
  it("returns null (deferred to box/none decision) for non-furniture", () => {
    expect(classifyShape("Peak Design Travel Backpack 45L", "Travel")).toEqual({
      shape: null,
      isApparel: false,
    });
    expect(classifyShape("Kindle Paperwhite (6.8-inch display)", "E-reader"))
      .toEqual({ shape: null, isApparel: false });
    expect(classifyShape("AirPods Max — USB-C", "Headphones")).toEqual({
      shape: null,
      isApparel: false,
    });
  });
  it("does not fire furniture keywords inside other words", () => {
    // 'rug' inside 'Ruggable', 'bed' inside 'embedded', 'seat' inside '3-Seater'
    expect(classifyShape("Ruggable embedded seater", "Home").shape).toBe(null);
  });
  it("lets a furniture keyword beat a bare apparel word", () => {
    // "boot"/"coat" must not suppress real, drawable furniture.
    expect(classifyShape("Entryway boot bench", "Home")).toEqual({
      shape: "chair",
      isApparel: false,
    });
    expect(classifyShape("Mudroom coat bench", "Home").shape).toBe("chair");
  });
});
