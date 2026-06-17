import { hasDatabase, prisma } from "./db";
import { getCutout } from "./cutout";
import { computeEnrichment, type EnrichmentFields } from "./enrich-compute";

/**
 * Write computed enrichment to a product (Prisma). Runs in the Next runtime
 * (the apply route, or inline in dev) — NOT in the standalone background
 * function, which stays Prisma-free. Never overwrites real data with nulls.
 */
export async function applyEnrichment(
  productId: string,
  fields: EnrichmentFields,
): Promise<void> {
  if (!hasDatabase()) return;
  const existing = await prisma.product.findUnique({
    where: { id: productId },
    select: { currentPrice: true, currency: true, imageUrl: true },
  });
  if (!existing) return;

  const data: Record<string, unknown> = {};
  if (fields.title && fields.title.length >= 3) data.title = fields.title;
  if (fields.gist) data.gist = JSON.stringify(fields.gist);
  if (fields.imageUrl) data.imageUrl = fields.imageUrl;
  if (fields.brand) data.brand = fields.brand;
  if (fields.availability) data.availability = fields.availability;
  if (fields.confidence) data.metadataConfidence = fields.confidence;
  if (fields.price != null) {
    data.currentPrice = fields.price;
    const cur = existing.currentPrice;
    data.lowestPrice = cur != null ? Math.min(cur, fields.price) : fields.price;
    data.highestPrice = cur != null ? Math.max(cur, fields.price) : fields.price;
  }
  if (Object.keys(data).length > 0) {
    await prisma.product.update({ where: { id: productId }, data });
  }

  if (typeof data.currentPrice === "number") {
    const have = await prisma.priceSnapshot.count({ where: { productId } });
    if (have === 0) {
      await prisma.priceSnapshot
        .create({
          data: {
            productId,
            price: data.currentPrice,
            currency: existing.currency ?? "USD",
            source: "parser",
          },
        })
        .catch(() => {});
    }
  }

  const img = (data.imageUrl as string | undefined) ?? existing.imageUrl;
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

/** Inline enrichment (dev path / no-timeout environments): read → compute → apply. */
export async function enrichProduct(productId: string): Promise<void> {
  if (!hasDatabase()) return;
  const p = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      originalUrl: true,
      title: true,
      brand: true,
      category: true,
      storeName: true,
    },
  });
  if (!p) return;
  const fields = await computeEnrichment({
    originalUrl: p.originalUrl,
    title: p.title,
    brand: p.brand,
    category: p.category,
    storeName: p.storeName,
  });
  await applyEnrichment(productId, fields);
}
