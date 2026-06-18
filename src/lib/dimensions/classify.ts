import type { ItemShape } from "./types";

/* ============================================================
   Item-shape classifier — picks which silhouette to draw from a
   product's title + category. Pure and deterministic.
   ============================================================ */

export interface ShapeResult {
  /** A specific furniture/tv silhouette, or null when none is confident. The
   *  neutral "box" is never chosen here — the orchestrator promotes a null to
   *  "box" only when a full width×depth×height triple is actually known. */
  shape: ItemShape | null;
  /** Garments: no honest 2D silhouette → draw nothing, let the gist carry it. */
  isApparel: boolean;
}

/**
 * Title keyword → shape. Order matters: this list is sorted MOST-SPECIFIC
 * (longest / multi-word) FIRST so "coffee table" wins over "table",
 * "bedside table" over "bed", "desk lamp" over "desk". The first keyword that
 * matches the title decides the shape.
 */
const KEYWORDS: ReadonlyArray<readonly [string, ItemShape]> = [
  // nightstand (before "table" / "bed")
  ["bedside table", "nightstand"],
  ["bedside cabinet", "nightstand"],
  ["night stand", "nightstand"],
  ["night table", "nightstand"],
  ["nightstand", "nightstand"],
  // lamp variants that embed "desk"/"table" (before desk/table)
  ["floor lamp", "lamp"],
  ["table lamp", "lamp"],
  ["desk lamp", "lamp"],
  ["pendant light", "lamp"],
  ["light fixture", "lamp"],
  ["torchiere", "lamp"],
  ["chandelier", "lamp"],
  ["sconce", "lamp"],
  ["lamp", "lamp"],
  // desk (before "table")
  ["standing desk", "desk"],
  ["sit-stand desk", "desk"],
  ["writing desk", "desk"],
  ["computer desk", "desk"],
  ["secretary desk", "desk"],
  ["workstation", "desk"],
  ["desk", "desk"],
  // dresser / case goods
  ["chest of drawers", "dresser"],
  ["drawer chest", "dresser"],
  ["dresser", "dresser"],
  ["bureau", "dresser"],
  ["tallboy", "dresser"],
  ["highboy", "dresser"],
  ["wardrobe", "dresser"],
  ["armoire", "dresser"],
  ["chiffonier", "dresser"],
  // shelf / storage
  ["bookcase", "shelf"],
  ["bookshelf", "shelf"],
  ["wall shelf", "shelf"],
  ["ladder shelf", "shelf"],
  ["cube storage", "shelf"],
  ["storage rack", "shelf"],
  ["shelving", "shelf"],
  ["etagere", "shelf"],
  ["credenza", "shelf"],
  ["sideboard", "shelf"],
  ["hutch", "shelf"],
  ["cabinet", "shelf"],
  ["shelf", "shelf"],
  // bed
  ["bed frame", "bed"],
  ["platform bed", "bed"],
  ["bunk bed", "bed"],
  ["murphy bed", "bed"],
  ["box spring", "bed"],
  ["king bed", "bed"],
  ["queen bed", "bed"],
  ["daybed", "bed"],
  ["headboard", "bed"],
  ["mattress", "bed"],
  ["bed", "bed"],
  // table
  ["coffee table", "table"],
  ["dining table", "table"],
  ["side table", "table"],
  ["end table", "table"],
  ["console table", "table"],
  ["kitchen table", "table"],
  ["dinette", "table"],
  ["tabletop", "table"],
  ["table", "table"],
  // sofa
  ["sleeper sofa", "sofa"],
  ["loveseat", "sofa"],
  ["sectional", "sofa"],
  ["settee", "sofa"],
  ["futon", "sofa"],
  ["chaise", "sofa"],
  ["divan", "sofa"],
  ["couch", "sofa"],
  ["sofa", "sofa"],
  // chair / seating
  ["office chair", "chair"],
  ["task chair", "chair"],
  ["accent chair", "chair"],
  ["dining chair", "chair"],
  ["rocking chair", "chair"],
  ["bar stool", "chair"],
  ["barstool", "chair"],
  ["armchair", "chair"],
  ["recliner", "chair"],
  ["rocker", "chair"],
  ["ottoman", "chair"],
  ["pouf", "chair"],
  ["stool", "chair"],
  ["bench", "chair"],
  ["aeron", "chair"],
  ["chair", "chair"],
  // rug (footprint) — NB never bare "runner" (that's a shoe)
  ["area rug", "rug"],
  ["runner rug", "rug"],
  ["floor mat", "rug"],
  ["doormat", "rug"],
  ["kilim", "rug"],
  ["carpet", "rug"],
  ["rug", "rug"],
  // tv / monitor — NB no bare "display"/"screen" (too generic; would catch
  // an e-reader's "6.8-inch display")
  ["smart tv", "tv"],
  ["led tv", "tv"],
  ["4k tv", "tv"],
  ["oled", "tv"],
  ["qled", "tv"],
  ["gaming monitor", "tv"],
  ["ultrawide", "tv"],
  ["television", "tv"],
  ["monitor", "tv"],
  ["tv", "tv"],
];

/** Garment words → no silhouette. */
const APPAREL = [
  "jacket",
  "fleece",
  "sweater",
  "sweatshirt",
  "hoodie",
  "pullover",
  "cardigan",
  "shirt",
  "t-shirt",
  "tee",
  "pants",
  "trousers",
  "jeans",
  "shorts",
  "dress",
  "skirt",
  "coat",
  "parka",
  "vest",
  "blazer",
  "leggings",
  "shoe",
  "shoes",
  "sneaker",
  "sneakers",
  "boot",
  "boots",
  "runners",
  "loafers",
  "sandals",
  "socks",
];

const APPAREL_CATEGORIES = new Set(["apparel", "footwear", "clothing"]);

/** Whole-keyword match bounded by non-letters (so "bed" ≠ "embedded"). */
function hasKeyword(textLower: string, kw: string): boolean {
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z])${esc}([^a-z]|$)`, "i").test(textLower);
}

/**
 * Resolve the silhouette for a product. Category Apparel/Footwear (or an
 * apparel keyword) short-circuits to the no-draw path even if a stray
 * furniture-sounding word appears. Otherwise the first matching title keyword
 * wins (most-specific-first). Brand is a weak tiebreaker only.
 */
export function classifyShape(
  title: string,
  category?: string | null,
  brand?: string | null,
): ShapeResult {
  const text = ` ${title} ${brand ?? ""} `.toLowerCase();
  const cat = (category ?? "").trim().toLowerCase();

  // Apparel/Footwear CATEGORY is a strong signal — short-circuit even if the
  // title contains a furniture-sounding word ("bench-made boots").
  if (APPAREL_CATEGORIES.has(cat)) return { shape: null, isApparel: true };

  // An explicit furniture/tv keyword beats a bare apparel WORD, so a real piece
  // of furniture isn't suppressed by "boot bench" / "coat rack".
  for (const [kw, shape] of KEYWORDS) {
    if (hasKeyword(text, kw)) return { shape, isApparel: false };
  }

  if (APPAREL.some((w) => hasKeyword(text, w))) {
    return { shape: null, isApparel: true };
  }
  return { shape: null, isApparel: false };
}
