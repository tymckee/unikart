import { scrapeStructured, scrapeRender } from "./parser/scrape";
import { extractProduct } from "./parser/extract";
import { summarizeProduct, type ProductGist } from "./ai/gist";

// PRISMA-FREE on purpose: this module runs inside the standalone Netlify
// Background Function, which bundles with esbuild and can't bundle Prisma's
// native client. The DB write lives in enrich.ts / the apply route instead.

const ENRICH_SCRAPE_TIMEOUT_MS = 40_000;

export interface EnrichmentFields {
  title?: string;
  price?: number | null;
  imageUrl?: string | null;
  brand?: string | null;
  availability?: string;
  confidence?: string;
  gist?: ProductGist;
}

export interface EnrichInput {
  originalUrl: string;
  title: string;
  brand?: string | null;
  category?: string | null;
  storeName?: string | null;
}

/** The slow part: real scrape (generous timeout) + AI normalize → the fields to
 * write. No DB, no Next APIs — safe to run in a background function. */
export async function computeEnrichment(
  input: EnrichInput,
): Promise<EnrichmentFields> {
  let scraped = await scrapeStructured(input.originalUrl, ENRICH_SCRAPE_TIMEOUT_MS);
  if (!scraped) {
    const html = await scrapeRender(input.originalUrl).catch(() => null);
    if (html) {
      try {
        scraped = extractProduct(html, input.originalUrl);
      } catch {
        /* ignore */
      }
    }
  }

  const pageText =
    scraped && typeof scraped.rawMetadata?.pageText === "string"
      ? scraped.rawMetadata.pageText
      : null;
  const gist = await summarizeProduct({
    title: scraped?.title || input.title,
    description: (pageText || scraped?.description || "").slice(0, 3000),
    brand: scraped?.brand ?? input.brand,
    category: scraped?.category ?? input.category,
    storeName: input.storeName,
  });

  const fields: EnrichmentFields = {};
  const cleanName = gist?.cleanName?.trim();
  if (cleanName && cleanName.length >= 3) fields.title = cleanName;
  else if (scraped?.title) fields.title = scraped.title;
  if (gist) fields.gist = gist;
  if (scraped) {
    if (scraped.imageUrl) fields.imageUrl = scraped.imageUrl;
    if (scraped.brand) fields.brand = scraped.brand;
    if (scraped.availability && scraped.availability !== "unknown")
      fields.availability = scraped.availability;
    if (scraped.confidence) fields.confidence = scraped.confidence;
    if (scraped.price != null) fields.price = scraped.price;
  }
  return fields;
}
