import * as cheerio from "cheerio";
import type { Availability, MetadataConfidence } from "../types";
import { categoryFromText, type ParsePreview } from "../parse-preview";
import { prettyDomain, storeNameFromDomain } from "../utils";

type Json = Record<string, unknown>;

function str(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim() || undefined;
  if (typeof v === "number") return String(v);
  return undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v !== "string") return undefined;
  let s = v.replace(/[^\d.,]/g, "");
  if (!s) return undefined;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > lastDot) {
    // Comma is the decimal separator (e.g. "19,99", "1.299,00") — unless it
    // looks like a lone thousands group ("1,234").
    const decimals = s.length - lastComma - 1;
    if (decimals === 3 && lastDot === -1) s = s.replace(/,/g, "");
    else s = s.replace(/\./g, "").replace(",", ".");
  } else {
    s = s.replace(/,/g, ""); // commas are thousands separators
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : undefined;
}

function abs(u: string | undefined, base: string): string | null {
  if (!u) return null;
  try {
    return new URL(u, base).toString();
  } catch {
    return null;
  }
}

function cleanTitle(t: string): string {
  const trimmed = (t || "").trim();
  // Drop a trailing " | Brand" / " – Brand" site suffix when present.
  const head = trimmed.split(/\s+[|–—]\s+/)[0]?.trim();
  return head || trimmed;
}

/* ---- JSON-LD ---- */

function collectJsonLd($: cheerio.CheerioAPI): Json[] {
  const out: Json[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const txt = $(el).text();
    if (!txt) return;
    try {
      const parsed = JSON.parse(txt);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of arr) {
        if (item && typeof item === "object") {
          out.push(item as Json);
          const graph = (item as Json)["@graph"];
          if (Array.isArray(graph)) {
            for (const g of graph) if (g && typeof g === "object") out.push(g as Json);
          }
        }
      }
    } catch {
      /* ignore malformed JSON-LD */
    }
  });
  return out;
}

function isType(obj: Json, type: string): boolean {
  const t = obj["@type"];
  const match = (x: unknown) =>
    typeof x === "string" && x.toLowerCase() === type.toLowerCase();
  return Array.isArray(t) ? t.some(match) : match(t);
}

function jsonLdImage(p: Json): string | undefined {
  const img = p["image"];
  if (typeof img === "string") return img;
  if (Array.isArray(img)) {
    const first = img[0];
    if (typeof first === "string") return first;
    if (first && typeof first === "object") return str((first as Json).url);
  }
  if (img && typeof img === "object") return str((img as Json).url);
  return undefined;
}

function jsonLdBrand(p: Json): string | undefined {
  const b = p["brand"];
  if (typeof b === "string") return b;
  if (b && typeof b === "object") return str((b as Json).name);
  return undefined;
}

function jsonLdOffer(p: Json): {
  price?: number;
  currency?: string;
  availability?: string;
} {
  let offers = p["offers"];
  if (Array.isArray(offers)) offers = offers[0];
  if (offers && typeof offers === "object") {
    const o = offers as Json;
    return {
      price: num(o["price"] ?? o["lowPrice"]),
      currency: str(o["priceCurrency"]),
      availability: str(o["availability"]),
    };
  }
  return {};
}

/* ---- meta map ---- */

function metaMap($: cheerio.CheerioAPI): Record<string, string> {
  const m: Record<string, string> = {};
  $("meta").each((_, el) => {
    const e = $(el);
    const key = (
      e.attr("property") ||
      e.attr("name") ||
      e.attr("itemprop") ||
      ""
    ).toLowerCase();
    const val = e.attr("content");
    if (key && val && !(key in m)) m[key] = val;
  });
  return m;
}

function pick(m: Record<string, string>, re: RegExp): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(m)) if (re.test(k)) out[k] = v;
  return out;
}

function mapAvailability(raw?: string): Availability {
  if (!raw) return "unknown";
  const s = raw.toLowerCase();
  if (/(^|[^t])instock|in[_ ]stock/.test(s)) return "in_stock";
  if (/outofstock|out[_ ]of[_ ]stock|sold ?out/.test(s)) return "out_of_stock";
  if (/limited|low ?stock/.test(s)) return "low_stock";
  if (/preorder|pre-order|backorder/.test(s)) return "preorder";
  return "unknown";
}

/**
 * Extract a product preview from raw HTML. Pure (no network), so it can be
 * unit-tested. Tries JSON-LD → Open Graph → Twitter → meta → HTML, in order.
 */
export function extractProduct(html: string, url: string): ParsePreview {
  const $ = cheerio.load(html);
  const meta = metaMap($);
  const product = collectJsonLd($).find((o) => isType(o, "Product")) ?? null;
  const offer = product ? jsonLdOffer(product) : {};

  const domain = prettyDomain(url);
  const storeName = str(meta["og:site_name"]) || storeNameFromDomain(domain);
  const fallbackTitle = `${storeName} product`;

  const title =
    (product && str(product["name"])) ||
    meta["og:title"] ||
    meta["twitter:title"] ||
    cleanTitle($("title").first().text()) ||
    fallbackTitle;

  const description =
    (product && str(product["description"])) ||
    meta["og:description"] ||
    meta["description"] ||
    meta["twitter:description"] ||
    `Saved from ${domain}.`;

  const imageRaw =
    (product && jsonLdImage(product)) ||
    meta["og:image:secure_url"] ||
    meta["og:image"] ||
    meta["twitter:image"] ||
    meta["twitter:image:src"] ||
    undefined;
  const imageUrl = abs(imageRaw, url);

  const price =
    offer.price ??
    num(meta["product:price:amount"]) ??
    num(meta["og:price:amount"]) ??
    num(meta["price"]) ??
    null;

  const currencyRaw =
    offer.currency ||
    meta["product:price:currency"] ||
    meta["og:price:currency"] ||
    meta["pricecurrency"] ||
    "USD";
  const currency = /^[A-Za-z]{3}$/.test(currencyRaw)
    ? currencyRaw.toUpperCase()
    : "USD";

  const availability = mapAvailability(
    offer.availability ||
      meta["product:availability"] ||
      meta["og:availability"] ||
      meta["availability"],
  );

  const brand =
    (product && jsonLdBrand(product)) ||
    str(meta["product:brand"]) ||
    str(meta["og:brand"]) ||
    null;

  const sku =
    (product && (str(product["sku"]) || str(product["mpn"]))) ||
    str(meta["product:retailer_item_id"]) ||
    null;

  const canonical =
    $('link[rel="canonical"]').attr("href") || meta["og:url"] || url;
  const canonicalUrl = abs(canonical, url) || url;

  const category = categoryFromText(`${title} ${description} ${domain}`);

  const hasTitle = Boolean(title && title !== fallbackTitle);
  const hasPrice = price != null;
  const hasImage = Boolean(imageUrl);
  let confidence: MetadataConfidence = "low";
  if (hasTitle && hasPrice && (Boolean(product) || hasImage)) {
    confidence = "high";
  } else if (hasTitle && (hasPrice || hasImage)) {
    confidence = "medium";
  }

  return {
    title: title.trim().slice(0, 200),
    description: description.trim().slice(0, 500),
    imageUrl,
    storeName,
    storeDomain: domain,
    category,
    brand: brand ? brand.slice(0, 120) : null,
    sku: sku ? sku.slice(0, 120) : null,
    price: price != null ? Math.round(price * 100) / 100 : null,
    currency,
    availability,
    confidence,
    originalUrl: url,
    canonicalUrl,
    source: "parser",
    rawMetadata: {
      jsonld: product ?? undefined,
      og: pick(meta, /^og:|^product:/),
      twitter: pick(meta, /^twitter:/),
      title: cleanTitle($("title").first().text()) || undefined,
    },
  };
}
