import { svgRound } from "@/lib/utils";
import type { DimensionPlane, ItemShape } from "./types";

/* ============================================================
   To-scale layout math for the dimension diagram. Pure and
   deterministic so it can be unit-tested and server-rendered
   (every coordinate is svgRound'd to avoid hydration drift).

   The honesty rule lives here: a single uniform px-per-unit is
   applied to BOTH plane axes (never separate x/y scales), so a
   cube reads as a cube and a wide-shallow rug reads wide and
   shallow. Objects are letterboxed, never stretched to fill.
   ============================================================ */

export const CANVAS = { w: 360, h: 240 } as const;

/** Reserved gutters for dimension lines + labels (no doorway in v1). */
const GUTTER = { left: 46, right: 46, top: 24, bottom: 44 } as const;

export const INNER = {
  x: GUTTER.left,
  y: GUTTER.top,
  w: CANVAS.w - GUTTER.left - GUTTER.right, // 268
  h: CANVAS.h - GUTTER.top - GUTTER.bottom, // 172
} as const;

const BOX_AR = INNER.w / INNER.h;

/** Smallest drawn edge — a sub-pixel sliver still needs something to annotate. */
const MIN_EDGE = 6;

/**
 * True when an aspect ratio fits the inner box without hitting the MIN_EDGE
 * clamp. Past these bounds the short axis would be floored and the two axes
 * would no longer share one scale — so the caller must NOT claim "to scale".
 */
export function aspectIsDrawable(ar: number): boolean {
  return (
    Number.isFinite(ar) &&
    ar <= INNER.w / MIN_EDGE &&
    ar >= MIN_EDGE / INNER.h
  );
}

export interface Face {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Rugs and beds are judged by floor footprint (W×D); everything else by its
 *  front elevation (W×H). */
export function planeForShape(shape: ItemShape): DimensionPlane {
  return shape === "rug" || shape === "bed" ? "footprint" : "elevation";
}

/** Comfortable default aspect ratio (plane-axisA / plane-axisB) used only when
 *  one plane axis is missing, so we have an honest-by-dashed shape to draw. */
export const DEFAULT_AR: Record<ItemShape, number> = {
  chair: 0.72,
  sofa: 2.3,
  table: 1.9,
  desk: 2.0,
  shelf: 0.62,
  dresser: 1.15,
  nightstand: 0.95,
  lamp: 0.34,
  tv: 1.6,
  box: 1.1,
  bed: 1.35, // footprint w/d
  rug: 1.5, // footprint w/d
};

/**
 * Letterbox a real face of aspect ratio `ar = physicalWidth / physicalHeight`
 * into the inner box, preserving proportions. Returns the centred face rect.
 */
export function fitFace(ar: number): Face {
  let w: number;
  let h: number;
  if (ar > BOX_AR) {
    w = INNER.w;
    h = svgRound(INNER.w / ar);
  } else {
    h = INNER.h;
    w = svgRound(INNER.h * ar);
  }
  w = Math.max(w, MIN_EDGE);
  h = Math.max(h, MIN_EDGE);
  return {
    x: svgRound(INNER.x + (INNER.w - w) / 2),
    y: svgRound(INNER.y + (INNER.h - h) / 2),
    w,
    h,
  };
}

/** Same letterbox, scaled to `scale` of the box — used for not-cross-product
 *  cases (single known axis, diameter-only, diagonal-only) so a default-aspect
 *  silhouette reads as slightly less assertive than a fully-measured one. */
export function fitDefaultFace(ar: number, scale = 0.86): Face {
  const f = fitFace(ar);
  const w = svgRound(f.w * scale);
  const h = svgRound(f.h * scale);
  return {
    x: svgRound(INNER.x + (INNER.w - w) / 2),
    y: svgRound(INNER.y + (INNER.h - h) / 2),
    w,
    h,
  };
}

/* ---- Dimension-line geometry (architect's elevation discipline) ---- */

export interface DimLine {
  /** The two witness/extension lines, [x1,y1,x2,y2]. */
  witness: [number, number, number, number][];
  /** The dimension line itself, [x1,y1,x2,y2]. */
  line: [number, number, number, number];
  /** Two 45° end ticks, [x1,y1,x2,y2]. */
  ticks: [number, number, number, number][];
  /** Label anchor (centre of the pill / text). */
  label: { x: number; y: number };
}

const r = svgRound;

/** Width dimension below the face. */
export function widthDim(f: Face): DimLine {
  const y = r(f.y + f.h + 16);
  const left = f.x;
  const right = r(f.x + f.w);
  return {
    witness: [
      [left, r(f.y + f.h + 4), left, r(y + 3)],
      [right, r(f.y + f.h + 4), right, r(y + 3)],
    ],
    line: [left, y, right, y],
    ticks: [
      [r(left - 3), r(y + 3), r(left + 3), r(y - 3)],
      [r(right - 3), r(y + 3), r(right + 3), r(y - 3)],
    ],
    label: { x: r(f.x + f.w / 2), y },
  };
}

/** Height (or footprint depth) dimension to the left of the face. */
export function heightDim(f: Face): DimLine {
  const x = r(f.x - 16);
  const top = f.y;
  const bottom = r(f.y + f.h);
  return {
    witness: [
      [r(f.x - 4), top, r(x - 3), top],
      [r(f.x - 4), bottom, r(x - 3), bottom],
    ],
    line: [x, top, x, bottom],
    ticks: [
      [r(x - 3), r(top + 3), r(x + 3), r(top - 3)],
      [r(x - 3), r(bottom + 3), r(x + 3), r(bottom - 3)],
    ],
    label: { x, y: r(f.y + f.h / 2) },
  };
}
