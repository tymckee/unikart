import type { Availability, MetadataConfidence } from "./types";
import { hashUnit, prettyDomain, storeNameFromDomain } from "./utils";

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

/**
 * Mock adapter — derives a plausible, deterministic preview from the URL alone.
 * Used as a graceful fallback when the live page can't be read (blocked,
 * offline, JS-only, etc.). The real reader is src/lib/parser.
 */
export function simulateParse(rawUrl: string): ParsePreview {
  const url = rawUrl.trim();
  const withProto = url.includes("://") ? url : `https://${url}`;
  const domain = prettyDomain(withProto);
  const storeName = storeNameFromDomain(domain);

  let slug = "";
  try {
    const u = new URL(withProto);
    const parts = u.pathname.split("/").filter(Boolean);
    slug = parts[parts.length - 1] ?? "";
  } catch {
    /* ignore */
  }
  const cleaned = slug
    .replace(/\.(html?|php|aspx?)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .trim();

  const seed = domain + slug;
  const h = hashUnit(seed);
  const price = Math.round((19 + h * 680) * 100) / 100;
  const category = categoryFromText(seed);

  const availability: Availability =
    h > 0.85 ? "out_of_stock" : h > 0.7 ? "low_stock" : "in_stock";

  return {
    title: cleaned || `${storeName} product`,
    description: `Saved from ${domain}. Confirm the details below.`,
    imageUrl: null,
    storeName,
    storeDomain: domain,
    category,
    brand: null,
    sku: null,
    price,
    currency: "USD",
    availability,
    confidence: "low",
    originalUrl: withProto,
    canonicalUrl: withProto,
    source: "fallback",
    rawMetadata: { source: "url-heuristic" },
  };
}
