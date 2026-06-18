import type { Measure, Unit } from "./types";

/* ============================================================
   Unit parsing, conversion, and display formatting.
   Pure helpers — no DOM, no React.
   ============================================================ */

/** Exact factor to convert a unit → millimetres (mm is our common base). */
const TO_MM: Record<Unit, number> = {
  mm: 1,
  cm: 10,
  in: 25.4,
  ft: 304.8,
  m: 1000,
};

/** Normalize a free-text unit token to a canonical Unit, or null if unknown. */
export function normalizeUnit(raw: string): Unit | null {
  const s = raw.trim().toLowerCase().replace(/\.$/, "");
  switch (s) {
    case '"':
    case "in":
    case "ins":
    case "inch":
    case "inches":
    case "inch.":
      return "in";
    case "'":
    case "ft":
    case "foot":
    case "feet":
      return "ft";
    case "cm":
    case "cms":
    case "centimeter":
    case "centimeters":
    case "centimetre":
    case "centimetres":
      return "cm";
    case "mm":
    case "millimeter":
    case "millimeters":
    case "millimetre":
    case "millimetres":
      return "mm";
    case "m":
    case "meter":
    case "meters":
    case "metre":
    case "metres":
      return "m";
    default:
      return null;
  }
}

/** Convert a measure to millimetres (for scale math — always exact). */
export function toMm(m: Measure): number {
  return m.value * TO_MM[m.unit];
}

/** Convert a measure to inches. */
export function toInches(m: Measure): number {
  return toMm(m) / 25.4;
}

/** Convert a measure to centimetres. */
export function toCentimeters(m: Measure): number {
  return toMm(m) / 10;
}

/** Round to at most `dp` decimals and drop trailing zeros (e.g. 18.50 → 18.5). */
export function fmtNum(n: number, dp = 1): string {
  const r = Math.round(n * 10 ** dp) / 10 ** dp;
  return String(r);
}

const ABBR: Record<Unit, string> = {
  in: "in",
  ft: "ft",
  cm: "cm",
  mm: "mm",
  m: "m",
};

/** "27 in", "120 cm" — the value in its own parsed unit. */
export function formatMeasure(m: Measure): string {
  return `${fmtNum(m.value)} ${ABBR[m.unit]}`;
}

/**
 * The complementary imperial/metric reading for the readout's muted secondary
 * text — never a second source of truth, just a convenience conversion of the
 * same parsed value. Imperial units (in/ft) → cm; metric (cm/mm/m) → in. We
 * promote to a larger unit when the number gets unwieldy (≥100 cm → m, ≥36 in
 * stays in for furniture familiarity).
 */
export function secondaryMeasure(m: Measure): string {
  const imperial = m.unit === "in" || m.unit === "ft";
  if (imperial) {
    const cm = toCentimeters(m);
    return cm >= 100 ? `${fmtNum(cm / 100, 2)} m` : `${fmtNum(cm)} cm`;
  }
  return `${fmtNum(toInches(m))} in`;
}
