import { toMm } from "./units";
import { classifyShape } from "./classify";
import {
  extractDiagonal,
  extractDimensionPhrase,
  parseAxisSpec,
  type AxisKey,
} from "./parse";
import { aspectIsDrawable, planeForShape } from "./geometry";
import type { DimensionModel, ItemShape, Measure } from "./types";

export type { DimensionModel } from "./types";

export interface DimensionInput {
  title: string;
  category?: string | null;
  brand?: string | null;
  description?: string | null;
  /** The gist's structured specs — the highest-signal source. */
  specs?: { label: string; value: string }[] | null;
}

type Axes = Partial<Record<AxisKey, Measure>>;
type HeadlineKey = DimensionModel["headline"];

/** A shape's most-decision-relevant axis — gets the single accent + aria lead. */
const NATURAL_HEADLINE: Record<ItemShape, HeadlineKey> = {
  chair: "height",
  sofa: "width",
  table: "width",
  desk: "width",
  bed: "width",
  shelf: "height",
  dresser: "height",
  nightstand: "height",
  rug: "width",
  lamp: "height",
  tv: "width",
  box: "width",
};

function present(axes: Axes, k: AxisKey): boolean {
  return axes[k] != null;
}

/**
 * Turn a product's text into the structured DimensionModel that drives the
 * diagram, or null when there's nothing honest to draw. Source priority:
 * gist specs → description → title. Only axes actually parsed are kept.
 */
export function deriveDimensions(input: DimensionInput): DimensionModel | null {
  const { shape: classified, isApparel } = classifyShape(
    input.title,
    input.category,
    input.brand,
  );
  // Garments have no honest 2D silhouette — let the gist's spec list carry
  // their measurements instead of inventing an outline.
  if (isApparel) return null;

  const specs = input.specs ?? [];
  const axes: Axes = {};
  let pendingDouble: [Measure, Measure] | null = null;

  // 1) Single trustworthy axes from labelled spec rows (e.g. {Height: "41 in"}).
  for (const sp of specs) {
    const a = parseAxisSpec(sp.label, sp.value);
    if (a && !axes[a.axis]) axes[a.axis] = a.measure;
  }

  // 2) Best multi-axis phrase across sources (specs first, then prose).
  const sources: string[] = [
    ...specs.map((s) => `${s.label}: ${s.value}`),
    input.description ?? "",
    input.title,
  ];
  for (const src of sources) {
    const phrase = extractDimensionPhrase(src);
    if (!phrase) continue;
    if (phrase.labeled) {
      const { W, D, H, L } = phrase.labeled;
      // "L x W x H" (length, then width) means W is the front-to-back depth;
      // "W x D x H" means W is the horizontal width. Disambiguate by whether a
      // D letter is present: L+W with no D → L is the width, W is the depth.
      if (L && W && !D) {
        axes.width ??= L;
        axes.depth ??= W;
        if (H) axes.height ??= H;
      } else {
        if (W) axes.width ??= W;
        if (D) axes.depth ??= D;
        if (H) axes.height ??= H;
        if (L) axes.length ??= L;
      }
    } else if (phrase.ordered?.length === 3) {
      const [a, b, c] = phrase.ordered; // W × D × H convention
      axes.width ??= a;
      axes.depth ??= b;
      axes.height ??= c;
    } else if (phrase.ordered?.length === 2 && !pendingDouble) {
      pendingDouble = [phrase.ordered[0], phrase.ordered[1]];
    }
    if (phrase.diameter) axes.diameter ??= phrase.diameter;
    // Stop once we have a full triple — nothing better to find.
    if (axes.width && axes.depth && axes.height) break;
  }

  // 3) L (length) is the long horizontal — fold into width when width is unset.
  if (axes.length && !axes.width) axes.width = axes.length;

  // 4) Resolve the silhouette. A null classifier only becomes a neutral box
  //    when a genuine W×D×H triple exists (a box needs three real extents).
  let shape = classified;
  if (!shape) {
    if (axes.width && axes.depth && axes.height) shape = "box";
    else return null;
  }
  const plane = planeForShape(shape);

  // 5) Now that the plane is known, place a leftover unlabelled pair.
  if (pendingDouble) {
    const [a, b] = pendingDouble;
    axes.width ??= a;
    if (plane === "footprint") axes.depth ??= b;
    else axes.height ??= b;
  }

  // 6) Screens: a lone diagonal is enough to draw a 16:9 rectangle.
  if (shape === "tv" && !axes.diagonal && !(axes.width && axes.height)) {
    for (const src of [input.title, ...sources]) {
      const d = extractDiagonal(src);
      if (d) {
        axes.diagonal = d;
        break;
      }
    }
  }

  const planeA: AxisKey = "width";
  const planeB: AxisKey = plane === "footprint" ? "depth" : "height";
  const roundDrawable =
    axes.diameter != null &&
    (shape === "rug" || shape === "table") &&
    !(present(axes, planeA) && present(axes, planeB));
  const diagonalDrawable =
    shape === "tv" &&
    axes.diagonal != null &&
    !(present(axes, "width") && present(axes, "height"));
  const planeDrawable = present(axes, planeA) || present(axes, planeB);

  if (!roundDrawable && !diagonalDrawable && !planeDrawable) return null;

  const headline = pickHeadline(shape, plane, axes, {
    roundDrawable,
    diagonalDrawable,
  });
  const toScale =
    diagonalDrawable || roundDrawable
      ? true // a circle / 16:9 rectangle is proportionally exact from one value
      : present(axes, planeA) &&
        present(axes, planeB) &&
        // At a degenerate aspect ratio the silhouette gets clamped and is no
        // longer truly proportional — don't claim "to scale" then.
        aspectIsDrawable(toMm(axes[planeA]!) / toMm(axes[planeB]!));

  return {
    shape,
    plane,
    width: axes.width,
    depth: axes.depth,
    height: axes.height,
    diameter: axes.diameter,
    diagonal: axes.diagonal,
    headline,
    toScale,
  };
}

function pickHeadline(
  shape: ItemShape,
  plane: "elevation" | "footprint",
  axes: Axes,
  flags: { roundDrawable: boolean; diagonalDrawable: boolean },
): DimensionModel["headline"] {
  if (flags.diagonalDrawable) return "diagonal";
  if (flags.roundDrawable) return "diameter";
  const planeAxes: HeadlineKey[] =
    plane === "footprint" ? ["width", "depth"] : ["width", "height"];
  if (shape === "bed" && present(axes, "width") && present(axes, "depth")) {
    return toMm(axes.width!) >= toMm(axes.depth!) ? "width" : "depth";
  }
  const natural = NATURAL_HEADLINE[shape];
  if (planeAxes.includes(natural) && present(axes, natural)) return natural;
  for (const k of planeAxes) if (present(axes, k)) return k;
  return natural;
}
