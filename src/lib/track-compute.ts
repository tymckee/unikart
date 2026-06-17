import { scrapeStructured, scrapeRender } from "./parser/scrape";
import { extractProduct } from "./parser/extract";
import { parseProduct } from "./parser";
import type { Availability } from "./types";

// PRISMA-FREE on purpose: this module runs inside the standalone Netlify
// Scheduled Function, which bundles with esbuild and can't bundle Prisma's
// native client. The DB write lives in /api/track/apply instead. No Next
// imports here either — only the parser layer + fetch.

const TRACK_SCRAPE_TIMEOUT_MS = 35_000;

export interface LivePriceInput {
  originalUrl: string;
  storeDomain?: string | null;
}

export interface LivePrice {
  price: number | null;
  availability: string;
}

function isAmazon(domain: string | null | undefined, url: string): boolean {
  const d = (domain || "").toLowerCase();
  if (/(^|\.)amazon\./i.test(d)) return true;
  try {
    return /(^|\.)amazon\./i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Read the current price + availability from the live product page. This is the
 * SLOW part of a tracking check (a real scrape), kept Prisma-free so it can run
 * in the scheduled function. Mirrors enrich-compute's scrape strategy:
 *   - Amazon  → ScraperAPI structured endpoint (generous 35s timeout).
 *   - others  → ScraperAPI render → extractProduct, else a polite direct fetch.
 *
 * Returns price=null when no real price is obtainable — we NEVER fabricate a
 * number. Availability is the parsed value, or "unknown" when unreadable.
 *
 * Dev fallback only: with no SCRAPERAPI_KEY AND not in production, we fall back
 * to the simulated market so local dev still demonstrates movement. Production
 * always uses real data.
 */
export async function fetchLivePrice(input: LivePriceInput): Promise<LivePrice> {
  const { originalUrl, storeDomain } = input;

  if (isAmazon(storeDomain, originalUrl)) {
    const scraped = await scrapeStructured(originalUrl, TRACK_SCRAPE_TIMEOUT_MS);
    if (scraped) {
      return {
        price: scraped.price ?? null,
        availability:
          scraped.availability && scraped.availability !== "unknown"
            ? scraped.availability
            : "unknown",
      };
    }
  } else {
    // Try the JS-rendered HTML via ScraperAPI first (gets past anti-bot walls),
    // then fall back to the polite direct fetch in parseProduct.
    const html = await scrapeRender(originalUrl).catch(() => null);
    if (html) {
      try {
        const p = extractProduct(html, originalUrl);
        return {
          price: p.price ?? null,
          availability:
            p.availability && p.availability !== "unknown"
              ? p.availability
              : "unknown",
        };
      } catch {
        /* fall through to direct fetch */
      }
    }
    const direct = await parseProduct(originalUrl).catch(() => null);
    if (direct && direct.source === "parser") {
      return {
        price: direct.price ?? null,
        availability:
          direct.availability && direct.availability !== "unknown"
            ? direct.availability
            : "unknown",
      };
    }
  }

  // DEV-ONLY fallback: no real price obtainable and no ScraperAPI key in a
  // non-production env → simulate so local demos still move. Production returns
  // honest nulls (no fabricated data).
  if (!process.env.SCRAPERAPI_KEY && process.env.NODE_ENV !== "production") {
    return devSimulatedPrice();
  }

  return { price: null, availability: "unknown" };
}

/** Explicitly-labeled dev stand-in. NOT used in production. */
function devSimulatedPrice(): LivePrice {
  const base = 50 + Math.random() * 450;
  const price = Math.round(base * 100) / 100;
  const a = Math.random();
  const availability: Availability =
    a < 0.08 ? "out_of_stock" : a < 0.18 ? "low_stock" : "in_stock";
  return { price, availability };
}
