import { hasDatabase, prisma } from "./db";
import { scrapeStructured, scrapeRender } from "./parser/scrape";
import { extractProduct } from "./parser/extract";
import { summarizeProduct } from "./ai/gist";
import { getCutout } from "./cutout";

// Generous timeout — enrichment runs in a background function (15-min budget),
// not the 10s request path, so a slow scrape is fine here.
const ENRICH_SCRAPE_TIMEOUT_MS = 40_000;

/**
 * Best-effort background enrichment of a saved product: do the slow real-data
 * scrape (Amazon structured today; render for others when premium proxies are
 * available), AI-normalize the name + gist, and update the product with the
 * real price / image / brand / specs. Never overwrites real data with nulls,
 * and is safe to re-run. No Next.js APIs here (runs inside a plain Netlify
 * Background Function); callers handle revalidation.
 */
export async function enrichProduct(productId: string): Promise<void> {
  if (!hasDatabase()) return;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      originalUrl: true,
      title: true,
      storeName: true,
      category: true,
      brand: true,
      imageUrl: true,
      currentPrice: true,
      currency: true,
    },
  });
  if (!product) return;

  // 1. Real data via the scrape layer (long timeout).
  let scraped = await scrapeStructured(product.originalUrl, ENRICH_SCRAPE_TIMEOUT_MS);
  if (!scraped) {
    const html = await scrapeRender(product.originalUrl).catch(() => null);
    if (html) {
      try {
        scraped = extractProduct(html, product.originalUrl);
      } catch {
        /* ignore */
      }
    }
  }

  // 2. AI-normalize a clean name + gist from the richest text we have.
  const pageText =
    scraped && typeof scraped.rawMetadata?.pageText === "string"
      ? scraped.rawMetadata.pageText
      : null;
  const gist = await summarizeProduct({
    title: scraped?.title || product.title,
    description: (pageText || scraped?.description || "").slice(0, 3000),
    brand: scraped?.brand ?? product.brand,
    category: scraped?.category ?? product.category,
    storeName: product.storeName,
  });

  // 3. Build the update — only set fields we genuinely learned.
  const data: Record<string, unknown> = {};
  const cleanName = gist?.cleanName?.trim();
  if (cleanName && cleanName.length >= 3) data.title = cleanName;
  else if (scraped?.title) data.title = scraped.title;
  if (gist) data.gist = JSON.stringify(gist);
  if (scraped) {
    if (scraped.imageUrl) data.imageUrl = scraped.imageUrl;
    if (scraped.brand) data.brand = scraped.brand;
    if (scraped.availability && scraped.availability !== "unknown")
      data.availability = scraped.availability;
    if (scraped.confidence) data.metadataConfidence = scraped.confidence;
    if (scraped.price != null) {
      data.currentPrice = scraped.price;
      const cur = product.currentPrice;
      data.lowestPrice = cur != null ? Math.min(cur, scraped.price) : scraped.price;
      data.highestPrice = cur != null ? Math.max(cur, scraped.price) : scraped.price;
    }
  }
  if (Object.keys(data).length === 0) return;

  await prisma.product.update({ where: { id: productId }, data });

  // 4. Record a first price point if we just learned a real price.
  if (typeof data.currentPrice === "number") {
    const have = await prisma.priceSnapshot.count({ where: { productId } });
    if (have === 0) {
      await prisma.priceSnapshot
        .create({
          data: {
            productId,
            price: data.currentPrice,
            currency: product.currency ?? "USD",
            source: "parser",
          },
        })
        .catch(() => {});
    }
  }

  // 5. Floating-product cutout (no-op in prod; works locally).
  const img = (data.imageUrl as string | undefined) ?? product.imageUrl;
  if (img) {
    try {
      const cutout = await getCutout(img);
      if (cutout) {
        await prisma.product.update({
          where: { id: productId },
          data: { cutoutUrl: cutout },
        });
      }
    } catch {
      /* best-effort */
    }
  }
}
