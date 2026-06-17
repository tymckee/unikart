import type { Availability, MetadataConfidence } from "./types";
import { hashUnit, prettyDomain, storeNameFromDomain } from "./utils";

export interface ParsePreview {
  title: string;
  description: string;
  storeName: string;
  storeDomain: string;
  category: string;
  price: number;
  currency: string;
  availability: Availability;
  confidence: MetadataConfidence;
  originalUrl: string;
  canonicalUrl: string;
}

const CATEGORY_HINTS: Array<[RegExp, string]> = [
  [/headphone|airpod|earbud|audio|speaker|sony|bose|sonos/i, "Headphones"],
  [/vacuum|dyson|kitchen|cook|le ?creuset|oven|blender/i, "Kitchen"],
  [/chair|desk|herman|office|monitor|standing/i, "Office"],
  [/switch|playstation|xbox|nintendo|game|gpu|console/i, "Gaming"],
  [/shirt|jacket|fleece|patagonia|hoodie|apparel|wear/i, "Apparel"],
  [/lego|toy|kids|puzzle/i, "Toys"],
  [/kindle|book|reader|ipad|tablet/i, "E-reader"],
  [/backpack|luggage|travel|peak ?design|tent|rei/i, "Travel"],
  [/shoe|runner|sneaker|allbirds|nike|footwear/i, "Footwear"],
  [/home|lamp|sofa|rug|decor|apartment/i, "Home"],
];

function guessCategory(text: string): string {
  for (const [re, cat] of CATEGORY_HINTS) if (re.test(text)) return cat;
  return "Home";
}

/**
 * Phase 1 stand-in for the real parser (Phase 3). Derives a plausible,
 * deterministic preview from the pasted URL so the save flow can be
 * demonstrated without a network fetch. Replaced by productParser later.
 */
export function simulateParse(rawUrl: string): ParsePreview {
  const url = rawUrl.trim();
  const withProto = url.includes("://") ? url : `https://${url}`;
  const domain = prettyDomain(withProto);
  const storeName = storeNameFromDomain(domain);

  // Build a readable title from the last path segment, if any.
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
  const category = guessCategory(seed);

  const availability: Availability =
    h > 0.85 ? "out_of_stock" : h > 0.7 ? "low_stock" : "in_stock";

  // Confidence reflects how much we could infer from the URL alone.
  const confidence: MetadataConfidence =
    cleaned.length > 6 ? "medium" : "low";

  return {
    title: cleaned || `${storeName} product`,
    description: `Saved from ${domain}. Details refine once tracking begins.`,
    storeName,
    storeDomain: domain,
    category,
    price,
    currency: "USD",
    availability,
    confidence,
    originalUrl: withProto,
    canonicalUrl: withProto,
  };
}
