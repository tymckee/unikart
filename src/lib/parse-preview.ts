import type { Availability, MetadataConfidence } from "./types";
import { prettyDomain, storeNameFromDomain } from "./utils";

export interface ParsePreview {
  title: string;
  description: string;
  imageUrl: string | null;
  storeName: string;
  storeDomain: string;
  category: string;
  brand: string | null;
  sku: string | null;
  price: number | null;
  currency: string;
  availability: Availability;
  confidence: MetadataConfidence;
  originalUrl: string;
  canonicalUrl: string;
  /** "parser" = read from the live page; "fallback" = inferred from the URL. */
  source: "parser" | "fallback";
  rawMetadata?: Record<string, unknown>;
}

const CATEGORY_HINTS: Array<[RegExp, string]> = [
  [/headphone|airpod|earbud|audio|speaker|sony|bose|sonos/i, "Headphones"],
  [/vacuum|dyson|kitchen|cook|le ?creuset|oven|blender|cookware/i, "Kitchen"],
  [/chair|desk|herman|office|monitor|standing/i, "Office"],
  [/switch|playstation|xbox|nintendo|game|gpu|console/i, "Gaming"],
  [/shirt|jacket|fleece|patagonia|hoodie|apparel|wear|clothing/i, "Apparel"],
  [/lego|toy|kids|puzzle/i, "Toys"],
  [/kindle|book|reader|ipad|tablet|e-reader/i, "E-reader"],
  [/backpack|luggage|travel|peak ?design|tent|rei|duffel/i, "Travel"],
  [/shoe|runner|sneaker|allbirds|nike|footwear|boot/i, "Footwear"],
  [/home|lamp|sofa|rug|decor|apartment|furniture/i, "Home"],
];

/** Best-effort category from any text (title/url). Falls back to "Home". */
export function categoryFromText(text: string): string {
  for (const [re, cat] of CATEGORY_HINTS) if (re.test(text)) return cat;
  return "Home";
}

/** Count the word-like tokens in a URL slug segment (3+ letters each). */
function slugWordCount(s: string): number {
  return s
    .replace(/\.(html?|php|aspx?)$/i, "")
    .split(/[-_]+/)
    .filter((w) => /[a-z]{3,}/i.test(w)).length;
}

/**
 * URL-only fallback used when the live page can't be read (blocked, offline,
 * JS-only). Derives an HONEST preview from the URL: a human-readable name from
 * the most descriptive path segment, the store from the domain, a best-effort
 * category — and crucially NO fabricated price or stock. Price stays null and
 * availability "unknown" so we never present invented numbers as if real.
 */
export function simulateParse(rawUrl: string): ParsePreview {
  const url = rawUrl.trim();
  const withProto = url.includes("://") ? url : `https://${url}`;
  const domain = prettyDomain(withProto);
  const storeName = storeNameFromDomain(domain);

  let segments: string[] = [];
  try {
    segments = new URL(withProto).pathname.split("/").filter(Boolean);
  } catch {
    /* ignore */
  }
  // Pick the most descriptive segment — retail URLs often put the readable slug
  // before a trailing SKU/code (e.g. /product/ray-ban-meta-wayfarer-.../BCKVZQZ5S6).
  const best =
    segments.slice().sort((a, b) => slugWordCount(b) - slugWordCount(a))[0] ?? "";
  const cleaned = best
    .replace(/\.(html?|php|aspx?)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();
  // Only treat it as a real name if it reads like words, not a bare SKU/code.
  const title = slugWordCount(best) >= 2 ? cleaned : `${storeName} item`;
  const category = categoryFromText(`${title} ${domain}`);

  return {
    title: title.slice(0, 200),
    description: `Saved from ${domain}. Add the details below.`,
    imageUrl: null,
    storeName,
    storeDomain: domain,
    category,
    brand: null,
    sku: null,
    price: null, // never fabricate a price
    currency: "USD",
    availability: "unknown" as Availability,
    confidence: "low",
    originalUrl: withProto,
    canonicalUrl: withProto,
    source: "fallback",
    rawMetadata: { source: "url-heuristic" },
  };
}
