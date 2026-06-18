/* ============================================================
   UniKart — Dimensions (the visual sibling of "the gist")
   Shared types for the structured dimension model that drives
   the to-scale diagram. Pure data — no React, no server code —
   so it's unit-testable and safe to import anywhere.
   ============================================================ */

/** Length units we read from listings. Values are kept in their parsed unit; a
 *  secondary imperial/metric counterpart is computed only for display. */
export type Unit = "in" | "cm" | "mm" | "ft" | "m";

export interface Measure {
  value: number;
  unit: Unit;
}

/**
 * The silhouette we draw for an item. Furniture-first (the user's ask:
 * tables, couches, chairs), plus tv/monitor and a neutral box fallback.
 * "apparel" is a sentinel: garments have no honest 2D size silhouette from
 * W/D/H, so we draw nothing and let the gist's spec list carry measurements.
 */
export type ItemShape =
  | "chair"
  | "sofa"
  | "table"
  | "desk"
  | "bed"
  | "shelf"
  | "dresser"
  | "nightstand"
  | "rug"
  | "lamp"
  | "tv"
  | "box";

/**
 * Which face we draw to scale:
 *  - elevation: a front view, plane = width × height (most furniture)
 *  - footprint: a top-down view, plane = width × depth (rugs, beds)
 */
export type DimensionPlane = "elevation" | "footprint";

/**
 * The single source of truth for a product's physical size. Only the axes we
 * actually parsed are present; a missing axis is never invented. The diagram,
 * the readout, and the gist spec grid all read from this one object so their
 * numbers can never disagree.
 */
export interface DimensionModel {
  shape: ItemShape;
  plane: DimensionPlane;
  width?: Measure;
  depth?: Measure;
  height?: Measure;
  /** Round items (round table/rug, lamp base) — drawn as a circle/ellipse. */
  diameter?: Measure;
  /** Screens — a diagonal sizes a 16:9 rectangle. */
  diagonal?: Measure;
  /** The axis a shopper most cares about for this shape; gets the lone accent. */
  headline: "width" | "depth" | "height" | "diameter" | "diagonal";
  /**
   * True when the silhouette's aspect ratio is genuinely to scale (both plane
   * axes known). False when only one plane axis is known and the other edge is
   * drawn illustratively (dashed) — the caption + aria soften the claim.
   */
  toScale: boolean;
}
