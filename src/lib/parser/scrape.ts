import type { Availability } from "../types";
import { categoryFromText, type ParsePreview } from "../parse-preview";
import { prettyDomain } from "../utils";

/**
 * ScraperAPI fetch layer. Used only when SCRAPERAPI_KEY is set; otherwise the
 * parser falls back to the polite direct fetch. ScraperAPI gets past the
 * anti-bot walls (Akamai/PerimeterX) that strip prices from a plain crawler.
 *
 * Two paths:
 *  - Amazon  → the free /structured/amazon/product endpoint returns clean
 *              product JSON (name, price, images, bullets) — no HTML parsing.
 *  - others  → render=true returns the JS-rendered HTML for extractProduct().
 *              (Best Buy / Target need premium residential proxies, which are a
 *              paid plan — those gracefully fall back to the URL heuristic.)
 */

const ENDPOINT = "https://api.scraperapi.com";
// Bounded so a slow ScraperAPI response can't blow the serverless function
// budget (Netlify free = 10s). A slow call aborts and degrades to the URL
// fallback rather than timing out the whole request.
const SCRAPE_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 4_000_000;

function priceNum(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v !== "string") return null;
  const m = v.replace(/,/g, "").match(/[0-9]+(?:\.[0-9]+)?/);
  if (!m) return null;
  const n = parseFloat(m[0]);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

function mapAvailability(v: unknown): Availability {
  const t = String(v ?? "").toLowerCase();
  if (/out of stock|unavailable|sold ?out|currently unavailable/.test(t))
    return "out_of_stock";
  if (/only \d+ left|low stock|limited/.test(t)) return "low_stock";
  if (/in stock|in-stock|available/.test(t)) return "in_stock";
  return "unknown";
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function amazonAsin(url: string): string | null {
  const m =
    url.match(/\/(?:dp|gp\/product|product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i) ||
    url.match(/\/([A-Z0-9]{10})(?:[/?]|$)/);
  return m ? m[1].toUpperCase() : null;
}

/** Amazon structured-endpoint JSON → ParsePreview (only the fields we use). */
type AmazonProduct = {
  name?: unknown;
  brand?: unknown;
  pricing?: unknown;
  list_price?: unknown;
  availability_status?: unknown;
  images?: unknown;
  high_res_images?: unknown;
  feature_bullets?: unknown;
  full_description?: unknown;
  asin?: unknown;
};

function amazonToPreview(
  d: AmazonProduct,
  url: string,
  domain: string,
): ParsePreview {
  const title = (asString(d.name) ?? "").slice(0, 200);
  const imgs = (Array.isArray(d.high_res_images) && d.high_res_images.length
    ? d.high_res_images
    : Array.isArray(d.images)
      ? d.images
      : []) as unknown[];
  const imageUrl = asString(imgs[0]);
  const bullets = (
    Array.isArray(d.feature_bullets) ? d.feature_bullets : []
  ).filter((b): b is string => typeof b === "string");
  const fullDesc = asString(d.full_description);
  const description = (fullDesc ?? bullets[0] ?? `Saved from ${domain}.`).slice(
    0,
    500,
  );
  // "Visit the WYZE SCALE Store" → "WYZE SCALE"
  const brand = asString(d.brand)
    ?.replace(/^visit the\s+/i, "")
    .replace(/\s+store$/i, "")
    .trim();
  const price = priceNum(d.pricing);
  // Full text for the (upcoming) AI normalizer to mine specs/summary from.
  const pageText = [fullDesc, ...bullets].filter(Boolean).join("\n").slice(0, 8000);

  return {
    title,
    description,
    imageUrl,
    storeName: "Amazon",
    storeDomain: domain,
    category: categoryFromText(`${title} ${bullets.join(" ")}`),
    brand: brand || null,
    sku: asString(d.asin),
    price,
    currency: "USD",
    availability: mapAvailability(d.availability_status),
    confidence: title && price != null ? "high" : title ? "medium" : "low",
    originalUrl: url,
    canonicalUrl: url,
    source: "parser",
    rawMetadata: { scraper: "scraperapi-amazon", pageText, bullets },
  };
}

/**
 * Amazon → structured product JSON as a ready ParsePreview. Returns null when
 * no key, not an Amazon URL, no ASIN, or the request fails (caller falls back).
 */
export async function scrapeStructured(
  url: string,
  timeoutMs: number = SCRAPE_TIMEOUT_MS,
): Promise<ParsePreview | null> {
  const key = process.env.SCRAPERAPI_KEY;
  if (!key) return null;
  const domain = prettyDomain(url);
  if (!/(^|\.)amazon\./i.test(domain)) return null;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // Prefer the ASIN, but fall back to the full URL (ScraperAPI accepts either)
    // so odd URL forms (mobile, share links, extra path/query) still resolve.
    const asin = amazonAsin(url);
    const param = asin ? `asin=${asin}` : `url=${encodeURIComponent(url)}`;
    const api = `${ENDPOINT}/structured/amazon/product?api_key=${encodeURIComponent(
      key,
    )}&${param}&country=us`;
    const res = await fetch(api, { signal: ctrl.signal });
    if (!res.ok) return null;
    const d = (await res.json()) as AmazonProduct;
    if (!asString(d.name)) return null;
    return amazonToPreview(d, url, domain);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generic render fetch → JS-rendered HTML for extractProduct(). Returns null
 * when no key or the request fails (e.g. a protected site needing premium
 * proxies on a paid plan).
 */
export async function scrapeRender(url: string): Promise<string | null> {
  const key = process.env.SCRAPERAPI_KEY;
  if (!key) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), SCRAPE_TIMEOUT_MS);
  try {
    const api = `${ENDPOINT}/?api_key=${encodeURIComponent(
      key,
    )}&render=true&url=${encodeURIComponent(url)}`;
    const res = await fetch(api, { signal: ctrl.signal });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!ct.includes("html") && !ct.includes("xml")) return null;
    return (await res.text()).slice(0, MAX_HTML_BYTES);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
