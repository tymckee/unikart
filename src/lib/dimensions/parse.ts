import type { Measure, Unit } from "./types";
import { normalizeUnit } from "./units";

/* ============================================================
   Dimension PARSER — turns noisy listing text into structured
   measures. Pure, deterministic, no network/AI. Conservative by
   design: it would rather return nothing than label a fabricated
   or mis-read number (brand §5/§7 — honest data, uncertainty
   shown by omission).

   It reads ONLY multi-axis phrases ("27\"W x 18.5\"D x 41\"H",
   "84 x 38 x 36 in"), round (diameter), and screen (diagonal)
   forms from free text. Single bare numbers are NEVER read from
   prose (so "45L", "6.8-inch display", "30-hour battery" can't be
   mistaken for a size); single axes come only from explicitly
   labelled spec rows, handled in index.ts.
   ============================================================ */

/** What a single dimension phrase yields. Either labelled axes (W/D/H/L from
 *  attached letters) OR an ordered list (unlabelled, positional), plus the
 *  round/screen specials. */
export interface ParsedPhrase {
  labeled?: Partial<Record<"W" | "D" | "H" | "L", Measure>>;
  ordered?: Measure[];
  diameter?: Measure;
  diagonal?: Measure;
}

const NUM = String.raw`\d+(?:\.\d+)?(?:[\s-]\d+\/\d+)?|\d+\/\d+`;
const UNIT = String.raw`"|″|”|''|in(?:ch(?:es)?)?|cm|mm|ft|feet|foot|m(?:eters?|etres?)?`;
const SEP = String.raw`\s*(?:x|×|✕|\*|\bby\b)\s*`;

/** Common display resolutions — never a physical dimension. */
const RESOLUTION = new Set([
  720, 768, 1080, 1280, 1366, 1440, 1600, 1920, 2160, 2560, 3440, 3840, 4096,
  5120,
]);

/** Plausible physical ranges per unit; anything outside is rejected wholesale. */
const RANGE: Record<Unit, [number, number]> = {
  in: [0.5, 200],
  ft: [0.3, 30],
  cm: [1, 510],
  mm: [5, 6000],
  m: [0.1, 8],
};

/** Parse "18.5", "18 1/2", "18-1/2", "1/2" → number, or null. */
export function numFromToken(tok: string): number | null {
  const s = tok.trim();
  if (!s) return null;
  // mixed number: "18 1/2" or "18-1/2"
  const mixed = s.match(/^(\d+)[\s-](\d+)\/(\d+)$/);
  if (mixed) {
    const [, whole, n, d] = mixed;
    const denom = Number(d);
    if (!denom) return null;
    return Number(whole) + Number(n) / denom;
  }
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const denom = Number(frac[2]);
    if (!denom) return null;
    return Number(frac[1]) / denom;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function inRange(value: number, unit: Unit): boolean {
  const [lo, hi] = RANGE[unit];
  return value >= lo && value <= hi;
}

/**
 * Build a validated Measure from a number token + (optional) unit token,
 * falling back to `fallbackUnit`. Returns null on a missing/implausible value.
 * When no unit is known at all, inches is assumed ONLY for plainly furniture-
 * scale values (1–110, not a screen resolution) — otherwise we bail.
 */
function mkMeasure(
  numTok: string,
  unitTok: string | null | undefined,
  fallbackUnit: Unit | null,
): Measure | null {
  const value = numFromToken(numTok);
  if (value == null || value <= 0) return null;

  let unit = unitTok ? normalizeUnit(unitTok) : null;
  if (!unit) unit = fallbackUnit;

  if (!unit) {
    if (value < 1 || value > 110 || RESOLUTION.has(value)) return null;
    unit = "in"; // US listings overwhelmingly omit the implied inch mark
  }
  if (!inRange(value, unit)) return null;
  return { value, unit };
}

/** First unit token present among the per-number units / trailing unit. */
function firstUnit(...toks: (string | null | undefined)[]): Unit | null {
  for (const t of toks) {
    if (t) {
      const u = normalizeUnit(t);
      if (u) return u;
    }
  }
  return null;
}

function parseTriple(text: string): ParsedPhrase | null {
  const re = new RegExp(
    `(${NUM})\\s*(${UNIT})?\\s*([WDHL])?${SEP}` +
      `(${NUM})\\s*(${UNIT})?\\s*([WDHL])?${SEP}` +
      `(${NUM})\\s*(${UNIT})?\\s*([WDHL])?\\s*(${UNIT})?`,
    "i",
  );
  const m = re.exec(text);
  if (!m) return null;
  const [, n1, u1, a1, n2, u2, a2, n3, u3, a3, trail] = m;
  const fallback = firstUnit(u1, u2, u3, trail);
  const letters = [a1, a2, a3];
  const allLetters = letters.every(Boolean);
  // A bare unitless prose phrase (no unit token anywhere, no axis letters) is
  // not trustworthy — refuse to fabricate inches from e.g. "Holds 2 x 4 lumber".
  if (!fallback && !allLetters) return null;
  const m1 = mkMeasure(n1, u1, fallback);
  const m2 = mkMeasure(n2, u2, fallback);
  const m3 = mkMeasure(n3, u3, fallback);
  if (!m1 || !m2 || !m3) return null;
  const upper = letters.map((l) => l?.toUpperCase());
  // Trust axis letters only when all three are present AND distinct; a repeated
  // letter ("30W x 40W x 50H") is malformed → fall back to positional W×D×H.
  if (allLetters && new Set(upper).size === 3) {
    return { labeled: assignLetters([m1, m2, m3], upper as string[]) };
  }
  return { ordered: [m1, m2, m3] };
}

function parseDouble(text: string): ParsedPhrase | null {
  const re = new RegExp(
    `(${NUM})\\s*(${UNIT})?\\s*([WDHL])?${SEP}` +
      `(${NUM})\\s*(${UNIT})?\\s*([WDHL])?\\s*(${UNIT})?`,
    "i",
  );
  const m = re.exec(text);
  if (!m) return null;
  const [, n1, u1, a1, n2, u2, a2, trail] = m;
  const fallback = firstUnit(u1, u2, trail);
  const letters = [a1, a2];
  const allLetters = letters.every(Boolean);
  // Bare unitless prose pair (no unit, no axis letters) → not a dimension.
  if (!fallback && !allLetters) return null;
  const m1 = mkMeasure(n1, u1, fallback);
  const m2 = mkMeasure(n2, u2, fallback);
  if (!m1 || !m2) return null;
  const upper = letters.map((l) => l?.toUpperCase());
  if (allLetters && new Set(upper).size === 2) {
    return { labeled: assignLetters([m1, m2], upper as string[]) };
  }
  return { ordered: [m1, m2] };
}

function assignLetters(
  measures: Measure[],
  letters: string[],
): Partial<Record<"W" | "D" | "H" | "L", Measure>> {
  const out: Partial<Record<"W" | "D" | "H" | "L", Measure>> = {};
  measures.forEach((measure, i) => {
    const l = letters[i] as "W" | "D" | "H" | "L";
    if (!out[l]) out[l] = measure;
  });
  return out;
}

// Only unambiguous round-shape triggers — NOT "across" (everyday prose for
// horizontal distance: "30 in across the room" is not a diameter).
const DIAMETER_RE = new RegExp(
  `(?:Ø|⌀|\\bdiameter\\b|\\bdia\\.?|\\bround\\b)\\s*[:=]?\\s*(${NUM})\\s*(${UNIT})?` +
    `|(${NUM})\\s*(${UNIT})?\\s*(?:\\bdiameter\\b|\\bdia\\.?|\\bround\\b)`,
  "i",
);

function parseDiameter(text: string): Measure | null {
  const m = DIAMETER_RE.exec(text);
  if (!m) return null;
  const numTok = m[1] ?? m[3];
  const unitTok = m[1] ? m[2] : m[4];
  if (!numTok) return null;
  return mkMeasure(numTok, unitTok, null);
}

/**
 * A lone screen size, e.g. "65-inch", "27\"", "55 in". Only meaningful for
 * a screen (the caller gates this to shape === "tv"), and only inch-scale
 * integers in a TV/monitor range to avoid catching "6.8-inch" e-readers.
 */
export function extractDiagonal(text: string): Measure | null {
  const re = new RegExp(
    `(?<![\\dx×.])(\\d{2,3})\\s*(?:-?\\s*inch(?:es)?\\b|"|″|”)`,
    "i",
  );
  const m = re.exec(text);
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value < 13 || value > 120) return null;
  return { value, unit: "in" };
}

/**
 * Best dimension phrase in a blob of text: a 3-axis phrase wins over a 2-axis
 * one, which wins over a round diameter. Diagonal is handled separately (it's
 * shape-gated). Returns null when nothing dimensional is found.
 */
export function extractDimensionPhrase(text: string): ParsedPhrase | null {
  if (!text) return null;
  const cleaned = text.replace(/\s+/g, " ");
  const triple = parseTriple(cleaned);
  if (triple) return triple;
  const double = parseDouble(cleaned);
  if (double) return double;
  const diameter = parseDiameter(cleaned);
  return diameter ? { diameter } : null;
}

/* ---- Single labelled axis from a spec row (e.g. {label:"Height", value:"41 in"}) ---- */

/** Spec labels that name an OVERALL axis we can trust as a single dimension. */
const AXIS_LABEL = /^(?:overall|assembled|product|total|item)?\s*(width|depth|height|length|diameter|diagonal)$/i;
/** Partial/component heights etc. we must NOT treat as the overall axis. */
const AXIS_LABEL_DENY = /\b(seat|arm|back|leg|inseam|sleeve|waist|chest|shoulder|strap|handle|heel|screen)\b/i;

export type AxisKey =
  | "width"
  | "depth"
  | "height"
  | "length"
  | "diameter"
  | "diagonal";

/** If a spec row is a single trustworthy axis, return {axis, measure}. */
export function parseAxisSpec(
  label: string,
  value: string,
): { axis: AxisKey; measure: Measure } | null {
  if (AXIS_LABEL_DENY.test(label)) return null;
  const lm = AXIS_LABEL.exec(label.trim());
  if (!lm) return null;
  const axis = lm[1].toLowerCase() as AxisKey;
  const v = value.trim();

  // Compound feet+inches ("6 ft 2 in", "5'6\"") → total inches, never truncated
  // to the feet (which would silently understate the size).
  const fi = /^\D*?(\d+)\s*(?:ft|feet|foot|')\s*(\d+(?:\.\d+)?)\s*(?:in|inch|inches|"|″|”)?/i.exec(
    v,
  );
  if (fi) {
    const measure = mkMeasure(String(Number(fi[1]) * 12 + Number(fi[2])), "in", null);
    return measure ? { axis, measure } : null;
  }

  // Reject ranges like "16-21 in" / "16 to 21 in" — ambiguous, not a fixed size.
  if (/\d\s*(?:-|–|to)\s*\d/.test(v) && !/\d[\s-]\d+\/\d/.test(v)) return null;

  // Number + trailing token. If a non-numeric token follows the number and it
  // is NOT a recognised length unit (px, lb, kg, GHz…), reject rather than
  // silently assume inches.
  const vm = new RegExp(`^\\D*?(${NUM})\\s*([A-Za-z"'″”]+)?`).exec(v);
  if (!vm) return null;
  const rawUnit = vm[2];
  if (rawUnit && !normalizeUnit(rawUnit)) return null;
  const measure = mkMeasure(vm[1], rawUnit ?? null, null);
  if (!measure) return null;
  return { axis, measure };
}
