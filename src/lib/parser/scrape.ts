import type { Availability } from "../types";
import { categoryFromText, type ParsePreview } from "../parse-preview";
import { prettyDomain } from "../utils";
import { isSafePublicUrl } from "./index";

/**
 * ScraperAPI fetch layer. Used only when SCRAPERAPI_KEY is set; otherwise the
 * parser falls back to the polite direct fetch. ScraperAPI gets past the
 * anti-bot walls (Akamai/PerimeterX) that strip prices from a plain crawler.
 *
 * Three paths (cheapest/most-reliable first):
 *  - Amazon  → the /structured/amazon/product endpoint returns clean product
 *              JSON (name, price, images, bullets) — no HTML parsing, no render.
 *  - Walmart → the /structured/walmart/product endpoint (keyed by the numeric
 *              item id in /ip/<slug>/<id>) — same idea, bypasses Walmart's wall.
 *  - others  → render=true returns the JS-rendered HTML for extractProduct().
 *              Works for cooperative sites (eBay, Target, Nike, …) reachable by
 *              ScraperAPI's datacenter proxies. Hard Akamai/PerimeterX walls
 *              (Home Depot, Best Buy, Costco, Macy's, …) need premium/residential
 *              proxies — NOT on the current plan — so those degrade gracefully to
 *              the branded gradient tile. See docs/product-images.md.
 */

const ENDPOINT = "https://api.scraperapi.com";
// Bounded so a slow ScraperAPI response can't blow the serverless function
// budget (Netlify free = 10s). A slow call aborts and degrades to the URL
// fallback rather than timing out the whole request.
const SCRAPE_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 4_000_000;

const AMAZON_DOMAIN = /(^|\.)amazon\./i;
// Amazon share/short links carry no ASIN in the path — resolve the redirect to
// the canonical amazon.com/dp/<ASIN> URL the structured endpoint needs.
const AMAZON_SHORT = /^(a\.co|amzn\.to|amzn\.com|amzn\.eu|amzn\.asia)$/i;
const WALMART_DOMAIN = /(^|\.)walmart\./i;
const RESOLVE_UA =
  "UniKartBot/1.0 (+https://uni-kart.com; resolves a shared product link on user request)";

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

export function amazonAsin(url: string): string | null {
  // The ASIN can sit in the path (…/dp/ASIN) or, for sponsored-ad links, be
  // URL-encoded inside a `url=` query param
  // (…/sspa/click?…&url=%2F…%2Fdp%2FASIN). Check the raw URL, then the decoded
  // `url=` param — first 10-char ASIN wins.
  const candidates = [url];
  try {
    const inner = new URL(url).searchParams.get("url");
    if (inner) candidates.push(inner); // URLSearchParams already percent-decodes
  } catch {
    /* not a parseable URL — scan the raw string only */
  }
  for (const c of candidates) {
    const m =
      c.match(/\/(?:dp|gp\/product|product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i) ||
      c.match(/\/([A-Z0-9]{10})(?:[/?]|$)/);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

/**
 * Chase redirects from an Amazon short/share link (a.co/…, amzn.to/…) until we
 * can read an ASIN from the resolved URL. SSRF-guarded: every hop is
 * re-validated and the body is discarded. We never trust an ASIN read from the
 * short link itself (its slug can look like an ASIN) — only from a real Amazon
 * host after the redirect. Returns the best ASIN + URL we reached.
 */
async function resolveAmazonAsin(
  start: string,
  signal: AbortSignal,
): Promise<{ asin: string | null; url: string }> {
  let current = start;
  for (let hop = 0; hop < 5; hop++) {
    if (!AMAZON_SHORT.test(prettyDomain(current))) {
      const asin = amazonAsin(current);
      if (asin) return { asin, url: current };
    }
    if (!isSafePublicUrl(current)) return { asin: null, url: current };
    let res: Response;
    try {
      res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal,
        headers: { "User-Agent": RESOLVE_UA },
      });
    } catch {
      return { asin: null, url: current };
    }
    res.body?.cancel().catch(() => {});
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { asin: null, url: current };
      try {
        current = new URL(loc, current).toString();
      } catch {
        return { asin: null, url: current };
      }
      continue;
    }
    return { asin: null, url: current }; // final page reached, no ASIN in URL
  }
  return { asin: null, url: current };
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

/** Walmart structured-endpoint JSON → ParsePreview (only the fields we use). */
type WalmartProduct = {
  product_name?: unknown;
  brand?: unknown;
  price?: unknown;
  price_currency?: unknown;
  product_availability?: unknown;
  images?: unknown;
  sku?: unknown;
  gtin?: unknown;
  product_short_description?: unknown;
  product_long_description?: unknown;
  product_highlights?: unknown;
};

/** The numeric item id in a Walmart product URL: /ip/<slug>/<id> or /ip/<id>. */
export function walmartItemId(url: string): string | null {
  const m = url.match(/\/ip\/(?:[^/?#]+\/)?(\d{5,})(?:[/?#]|$)/i);
  return m ? m[1] : null;
}

function walmartToPreview(
  d: WalmartProduct,
  url: string,
  domain: string,
): ParsePreview {
  const title = (asString(d.product_name) ?? "").slice(0, 200);
  const imgs = (Array.isArray(d.images) ? d.images : []) as unknown[];
  const imageUrl = asString(imgs[0]);
  const highlights = (
    Array.isArray(d.product_highlights) ? d.product_highlights : []
  ).filter((b): b is string => typeof b === "string");
  const longDesc = asString(d.product_long_description);
  const description = (
    asString(d.product_short_description) ??
    longDesc ??
    highlights[0] ??
    `Saved from ${domain}.`
  ).slice(0, 500);
  const price = priceNum(d.price);
  const currencyRaw = asString(d.price_currency) ?? "USD";
  const currency = /^[A-Za-z]{3}$/.test(currencyRaw)
    ? currencyRaw.toUpperCase()
    : "USD";
  const pageText = [longDesc, ...highlights].filter(Boolean).join("\n").slice(0, 8000);

  return {
    title,
    description,
    imageUrl,
    storeName: "Walmart",
    storeDomain: domain,
    category: categoryFromText(`${title} ${highlights.join(" ")}`),
    brand: asString(d.brand),
    sku: asString(d.sku) ?? asString(d.gtin),
    price,
    currency,
    availability: mapAvailability(d.product_availability),
    confidence: title && price != null ? "high" : title ? "medium" : "low",
    originalUrl: url,
    canonicalUrl: url,
    source: "parser",
    rawMetadata: { scraper: "scraperapi-walmart", pageText, bullets: highlights },
  };
}

/**
 * Retailer-specific structured product JSON → a ready ParsePreview. Far more
 * reliable than rendering HTML: it bypasses the merchant's bot wall and returns
 * clean fields (name, price, images, stock). Dispatches by domain; returns null
 * for retailers without a structured endpoint (the caller falls back to render).
 */
export async function scrapeStructured(
  url: string,
  timeoutMs: number = SCRAPE_TIMEOUT_MS,
): Promise<ParsePreview | null> {
  const key = process.env.SCRAPERAPI_KEY;
  if (!key) return null;
  const domain = prettyDomain(url);
  if (AMAZON_DOMAIN.test(domain) || AMAZON_SHORT.test(domain)) {
    return scrapeAmazon(url, key, timeoutMs);
  }
  if (WALMART_DOMAIN.test(domain)) {
    return scrapeWalmart(url, key, domain, timeoutMs);
  }
  return null;
}

async function scrapeAmazon(
  url: string,
  key: string,
  timeoutMs: number,
): Promise<ParsePreview | null> {
  const isShort = AMAZON_SHORT.test(prettyDomain(url));
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    // Resolve a clean ASIN first: sponsored-ad links (…/sspa/click?…url=%2F…
    // %2Fdp%2FASIN) are decoded by amazonAsin; short links (a.co/…) need a
    // redirect chase. A short link's own slug is never trusted as an ASIN.
    let asin = isShort ? null : amazonAsin(url);
    let resolvedUrl = url;
    if (!asin) {
      const r = await resolveAmazonAsin(url, ctrl.signal);
      asin = r.asin;
      resolvedUrl = r.url;
    }
    // Prefer the ASIN, but fall back to the resolved URL (ScraperAPI follows
    // redirects too) so odd URL forms still have a chance to resolve.
    const param = asin
      ? `asin=${asin}`
      : `url=${encodeURIComponent(resolvedUrl)}`;
    const api = `${ENDPOINT}/structured/amazon/product?api_key=${encodeURIComponent(
      key,
    )}&${param}&country=us`;
    const res = await fetch(api, { signal: ctrl.signal });
    if (!res.ok) return null;
    const d = (await res.json()) as AmazonProduct;
    if (!asString(d.name)) return null;
    return amazonToPreview(d, resolvedUrl, prettyDomain(resolvedUrl));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function scrapeWalmart(
  url: string,
  key: string,
  domain: string,
  timeoutMs: number,
): Promise<ParsePreview | null> {
  // The structured endpoint is keyed by the numeric item id, not the URL.
  const id = walmartItemId(url);
  if (!id) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const api = `${ENDPOINT}/structured/walmart/product?api_key=${encodeURIComponent(
      key,
    )}&product_id=${encodeURIComponent(id)}&country=us`;
    const res = await fetch(api, { signal: ctrl.signal });
    if (!res.ok) return null;
    const d = (await res.json()) as WalmartProduct;
    if (!asString(d.product_name)) return null;
    return walmartToPreview(d, url, domain);
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
 *
 * A JS render is SLOW (a heavy retail PDP routinely takes 30–60s), so callers
 * must pass a generous timeout. The 8s default suits only the inline request
 * path; background enrichment passes ~55s (it runs in a 15-min function).
 */
export async function scrapeRender(
  url: string,
  timeoutMs: number = SCRAPE_TIMEOUT_MS,
): Promise<string | null> {
  const key = process.env.SCRAPERAPI_KEY;
  if (!key) return null;
  // A cheap datacenter render first. Covers cooperative sites (eBay, Target, …).
  const direct = await renderOnce(url, key, "", timeoutMs);
  if (direct) return direct;
  // Hard anti-bot walls (Akamai/PerimeterX on Home Depot, Best Buy, Costco, …)
  // reject datacenter proxies — they need ScraperAPI's residential/premium pool,
  // which is a PAID plan. We escalate only on failure and only when a premium
  // plan is configured (SCRAPERAPI_PREMIUM); the free tier rejects these params,
  // so calling them unconditionally would just waste a request. Flip the env var
  // after upgrading and these retailers start resolving with no code change.
  const premium = premiumParam();
  return premium ? renderOnce(url, key, premium, timeoutMs) : null;
}

/** Map SCRAPERAPI_PREMIUM to the right proxy param, or "" to stay on datacenter. */
function premiumParam(): string {
  const v = (process.env.SCRAPERAPI_PREMIUM || "").toLowerCase();
  if (v === "ultra" || v === "true" || v === "1") return "&ultra_premium=true";
  if (v === "premium") return "&premium=true";
  return "";
}

async function renderOnce(
  url: string,
  key: string,
  proxyParam: string,
  timeoutMs: number,
): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const api = `${ENDPOINT}/?api_key=${encodeURIComponent(
      key,
    )}&render=true${proxyParam}&url=${encodeURIComponent(url)}`;
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
