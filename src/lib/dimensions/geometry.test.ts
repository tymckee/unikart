import { describe, it, expect } from "vitest";
import {
  fitFace,
  fitDefaultFace,
  planeForShape,
  aspectIsDrawable,
  widthDim,
  heightDim,
  INNER,
} from "./geometry";

describe("fitFace — one uniform scale, never stretched", () => {
  it("a cube (ar=1) reads as a square, centred", () => {
    const f = fitFace(1);
    expect(f.w).toBe(f.h); // square in, square out — the honesty invariant
    expect(f.h).toBe(INNER.h);
    expect(f.x).toBe(94); // centred in the 268-wide inner box
    expect(f.y).toBe(INNER.y);
  });
  it("a wide face is width-bound", () => {
    const f = fitFace(2);
    expect(f.w).toBe(INNER.w);
    expect(f.h).toBe(134); // 268 / 2
  });
  it("a tall face is height-bound", () => {
    const f = fitFace(0.5);
    expect(f.h).toBe(INNER.h);
    expect(f.w).toBe(86); // 172 * 0.5
  });
});

describe("fitDefaultFace — slightly inset for not-cross-product cases", () => {
  it("stays square and smaller than a full fit", () => {
    const d = fitDefaultFace(1);
    expect(d.w).toBe(d.h);
    expect(d.w).toBeLessThan(fitFace(1).w);
  });
});

describe("aspectIsDrawable — guards the to-scale claim at extremes", () => {
  it("accepts normal furniture ratios, rejects degenerate ones", () => {
    expect(aspectIsDrawable(1)).toBe(true);
    expect(aspectIsDrawable(4)).toBe(true);
    expect(aspectIsDrawable(72)).toBe(false); // a 144x2 sliver
    expect(aspectIsDrawable(0.01)).toBe(false);
    expect(aspectIsDrawable(NaN)).toBe(false);
  });
});

describe("planeForShape", () => {
  it("rugs and beds are footprints; the rest are elevations", () => {
    expect(planeForShape("rug")).toBe("footprint");
    expect(planeForShape("bed")).toBe("footprint");
    expect(planeForShape("chair")).toBe("elevation");
    expect(planeForShape("tv")).toBe("elevation");
  });
});

describe("dimension-line geometry", () => {
  const face = { x: 100, y: 40, w: 120, h: 100 };
  it("width line is horizontal and centred under the face", () => {
    const d = widthDim(face);
    expect(d.line[1]).toBe(d.line[3]); // same y → horizontal
    expect(d.label.x).toBe(160); // x + w/2
  });
  it("height line is vertical to the left of the face", () => {
    const d = heightDim(face);
    expect(d.line[0]).toBe(d.line[2]); // same x → vertical
    expect(d.line[0]).toBeLessThan(face.x);
  });
});
