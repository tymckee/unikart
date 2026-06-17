"use server";

import { revalidatePath } from "next/cache";
import { hasDatabase, prisma } from "./db";
import { parseProduct } from "./parser";
import { getCutout } from "./cutout";
import { summarizeProduct, type ProductGist } from "./ai/gist";
import { runPriceStockCheck } from "./jobs/price-stock";
import type { ParsePreview } from "./parse-preview";
import type { Availability, MetadataConfidence } from "./types";

const USER_ID = "user_1";

/** Read a product preview from a pasted URL (server-side fetch + parse). */
export async function parseProductUrl(url: string): Promise<ParsePreview> {
  return parseProduct(url);
}

/** Manually run the price/stock check (the "Run check now" button). */
export async function runPriceCheckNow(): Promise<
  ActionResult<{ priceChanges: number; stockChanges: number; notifications: number }>
> {
  if (!hasDatabase()) return NO_DB;
  try {
    const s = await runPriceStockCheck();
    revalidateAll();
    return {
      ok: true,
      data: {
        priceChanges: s.priceChanges,
        stockChanges: s.stockChanges,
        notifications: s.notifications,
      },
    };
  } catch (e) {
    console.error("[action] runPriceCheckNow:", e);
    return { ok: false, reason: "error" };
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; reason: "no-database" | "not-found" | "error"; message?: string };

const NO_DB = { ok: false, reason: "no-database" } as const;

function revalidateAll() {
  revalidatePath("/dashboard");
  revalidatePath("/collections");
  revalidatePath("/cart");
  revalidatePath("/notifications");
}

async function getOrCreateActiveCartId(): Promise<string> {
  const existing = await prisma.universalCart.findFirst({
    where: { userId: USER_ID, status: "active" },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.universalCart.create({
    data: { userId: USER_ID, name: "Universal Cart", status: "active" },
    select: { id: true },
  });
  return created.id;
}

export interface SaveProductInput {
  title: string;
  description?: string | null;
  originalUrl: string;
  canonicalUrl?: string | null;
  imageUrl?: string | null;
  storeName: string;
  storeDomain: string;
  brand?: string | null;
  sku?: string | null;
  category?: string | null;
  currency?: string;
  price: number | null;
  availability?: Availability;
  confidence?: MetadataConfidence;
  rawMetadata?: Record<string, unknown> | null;
  collectionId?: string | null;
  watch?: boolean;
  targetPrice?: number | null;
}

export async function saveProduct(
  input: SaveProductInput,
): Promise<ActionResult<{ id: string }>> {
  if (!hasDatabase()) return NO_DB;
  if (!input.title?.trim() || !input.originalUrl?.trim()) {
    return { ok: false, reason: "error", message: "Title and URL are required." };
  }
  try {
    const currency = input.currency ?? "USD";
    const price = input.price ?? null;
    const product = await prisma.product.create({
      data: {
        userId: USER_ID,
        title: input.title.trim(),
        description: input.description ?? null,
        originalUrl: input.originalUrl.trim(),
        canonicalUrl: input.canonicalUrl ?? input.originalUrl.trim(),
        imageUrl: input.imageUrl ?? null,
        storeName: input.storeName,
        storeDomain: input.storeDomain,
        brand: input.brand ?? null,
        sku: input.sku ?? null,
        category: input.category ?? null,
        currency,
        currentPrice: price,
        previousPrice: null,
        lowestPrice: price,
        highestPrice: price,
        availability: input.availability ?? "unknown",
        metadataConfidence: input.confidence ?? "low",
        rawMetadata: input.rawMetadata
          ? JSON.stringify(input.rawMetadata).slice(0, 16000)
          : null,
        priceSnapshots:
          price != null
            ? { create: [{ price, currency, source: "parser" }] }
            : undefined,
        alerts:
          input.watch || input.targetPrice
            ? {
                create: [
                  {
                    userId: USER_ID,
                    type: input.targetPrice ? "target_price" : "price_drop",
                    targetPrice: input.targetPrice ?? null,
                    enabled: true,
                  },
                ],
              }
            : undefined,
      },
      select: { id: true },
    });

    // Link a collection only if it genuinely exists for this user — never let
    // a stale/unknown collection id abort the product insert (FK violation).
    if (input.collectionId) {
      const col = await prisma.collection.findFirst({
        where: { id: input.collectionId, userId: USER_ID },
        select: { id: true },
      });
      if (col) {
        await prisma.productCollection
          .create({ data: { productId: product.id, collectionId: col.id } })
          .catch(() => {});
      }
    }

    // Best-effort AI background-removal (no-op until a provider is configured).
    if (input.imageUrl) {
      try {
        const cutout = await getCutout(input.imageUrl);
        if (cutout) {
          await prisma.product.update({
            where: { id: product.id },
            data: { cutoutUrl: cutout },
          });
        }
      } catch (e) {
        console.error("[action] cutout:", e);
      }
    }

    revalidateAll();
    return { ok: true, data: { id: product.id } };
  } catch (e) {
    console.error("[action] saveProduct:", e);
    return { ok: false, reason: "error" };
  }
}

export async function addToCart(productId: string): Promise<ActionResult> {
  if (!hasDatabase()) return NO_DB;
  try {
    const cartId = await getOrCreateActiveCartId();
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { availability: true },
    });
    await prisma.universalCartItem.upsert({
      where: { cartId_productId: { cartId, productId } },
      create: {
        cartId,
        productId,
        merchantStatus: product?.availability ?? "unknown",
        checkoutStatus: "ready",
      },
      update: {},
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    console.error("[action] addToCart:", e);
    return { ok: false, reason: "error" };
  }
}

export async function removeFromCartItem(itemId: string): Promise<ActionResult> {
  if (!hasDatabase()) return NO_DB;
  try {
    await prisma.universalCartItem.delete({ where: { id: itemId } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    console.error("[action] removeFromCartItem:", e);
    return { ok: false, reason: "error" };
  }
}

export async function removeProductFromCart(
  productId: string,
): Promise<ActionResult> {
  if (!hasDatabase()) return NO_DB;
  try {
    const cart = await prisma.universalCart.findFirst({
      where: { userId: USER_ID, status: "active" },
      select: { id: true },
    });
    if (cart) {
      await prisma.universalCartItem.deleteMany({
        where: { cartId: cart.id, productId },
      });
    }
    revalidateAll();
    return { ok: true };
  } catch (e) {
    console.error("[action] removeProductFromCart:", e);
    return { ok: false, reason: "error" };
  }
}

export async function setAlert(
  productId: string,
  opts: { enabled: boolean; targetPrice?: number | null },
): Promise<ActionResult> {
  if (!hasDatabase()) return NO_DB;
  try {
    const existing = await prisma.alertRule.findFirst({
      where: { productId, userId: USER_ID },
      select: { id: true },
    });
    const type = opts.targetPrice ? "target_price" : "price_drop";
    if (existing) {
      await prisma.alertRule.update({
        where: { id: existing.id },
        data: { enabled: opts.enabled, targetPrice: opts.targetPrice ?? null, type },
      });
    } else if (opts.enabled) {
      await prisma.alertRule.create({
        data: {
          productId,
          userId: USER_ID,
          type,
          targetPrice: opts.targetPrice ?? null,
          enabled: true,
        },
      });
    }
    revalidateAll();
    return { ok: true };
  } catch (e) {
    console.error("[action] setAlert:", e);
    return { ok: false, reason: "error" };
  }
}

export async function markPurchased(productId: string): Promise<ActionResult> {
  if (!hasDatabase()) return NO_DB;
  try {
    await prisma.product.update({
      where: { id: productId },
      data: { isPurchased: true, purchasedAt: new Date() },
    });
    await prisma.universalCartItem.deleteMany({ where: { productId } });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    console.error("[action] markPurchased:", e);
    return { ok: false, reason: "error" };
  }
}

export async function archiveProduct(productId: string): Promise<ActionResult> {
  if (!hasDatabase()) return NO_DB;
  try {
    await prisma.product.update({
      where: { id: productId },
      data: { isArchived: true },
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    console.error("[action] archiveProduct:", e);
    return { ok: false, reason: "error" };
  }
}

export async function updateNotes(
  productId: string,
  notes: string,
): Promise<ActionResult> {
  if (!hasDatabase()) return NO_DB;
  try {
    await prisma.product.update({
      where: { id: productId },
      data: { notes },
    });
    revalidatePath(`/products/${productId}`);
    return { ok: true };
  } catch (e) {
    console.error("[action] updateNotes:", e);
    return { ok: false, reason: "error" };
  }
}

export async function createCollection(
  name: string,
  icon = "cpu",
): Promise<ActionResult<{ id: string }>> {
  if (!hasDatabase()) return NO_DB;
  if (!name.trim()) return { ok: false, reason: "error", message: "Name required." };
  try {
    const last = await prisma.collection.findFirst({
      where: { userId: USER_ID },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const created = await prisma.collection.create({
      data: {
        userId: USER_ID,
        name: name.trim(),
        icon,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      },
      select: { id: true },
    });
    revalidatePath("/collections");
    return { ok: true, data: { id: created.id } };
  } catch (e) {
    console.error("[action] createCollection:", e);
    return { ok: false, reason: "error" };
  }
}

export interface UpdateProductInput {
  title?: string;
  originalUrl?: string;
  storeName?: string;
  storeDomain?: string;
  category?: string | null;
  currency?: string;
  currentPrice?: number | null;
  availability?: Availability;
  description?: string | null;
}

export async function updateProduct(
  productId: string,
  input: UpdateProductInput,
): Promise<ActionResult> {
  if (!hasDatabase()) return NO_DB;
  try {
    const existing = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        currentPrice: true,
        currency: true,
        lowestPrice: true,
        highestPrice: true,
      },
    });
    if (!existing) return { ok: false, reason: "not-found" };

    const priceChanged =
      input.currentPrice !== undefined &&
      input.currentPrice !== existing.currentPrice;
    const newPrice = input.currentPrice ?? null;

    await prisma.product.update({
      where: { id: productId },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.originalUrl !== undefined
          ? { originalUrl: input.originalUrl, canonicalUrl: input.originalUrl }
          : {}),
        ...(input.storeName !== undefined ? { storeName: input.storeName } : {}),
        ...(input.storeDomain !== undefined
          ? { storeDomain: input.storeDomain }
          : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.availability !== undefined
          ? { availability: input.availability }
          : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(priceChanged
          ? {
              currentPrice: newPrice,
              previousPrice: existing.currentPrice,
              lowestPrice:
                newPrice != null
                  ? Math.min(existing.lowestPrice ?? newPrice, newPrice)
                  : existing.lowestPrice,
              highestPrice:
                newPrice != null
                  ? Math.max(existing.highestPrice ?? newPrice, newPrice)
                  : existing.highestPrice,
              lastCheckedAt: new Date(),
              ...(newPrice != null
                ? {
                    priceSnapshots: {
                      create: [
                        {
                          price: newPrice,
                          currency: input.currency ?? existing.currency,
                          source: "manual",
                        },
                      ],
                    },
                  }
                : {}),
            }
          : {}),
      },
    });
    revalidateAll();
    revalidatePath(`/products/${productId}`);
    return { ok: true };
  } catch (e) {
    console.error("[action] updateProduct:", e);
    return { ok: false, reason: "error" };
  }
}

export async function generateGist(
  productId: string,
): Promise<ActionResult<ProductGist>> {
  if (!hasDatabase()) return NO_DB;
  try {
    const p = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        title: true,
        description: true,
        brand: true,
        category: true,
        storeName: true,
      },
    });
    if (!p) return { ok: false, reason: "not-found" };
    const gist = await summarizeProduct(p);
    if (!gist) return { ok: false, reason: "error" };
    await prisma.product.update({
      where: { id: productId },
      data: { gist: JSON.stringify(gist) },
    });
    revalidatePath(`/products/${productId}`);
    return { ok: true, data: gist };
  } catch (e) {
    console.error("[action] generateGist:", e);
    return { ok: false, reason: "error" };
  }
}

export async function setProductCollections(
  productId: string,
  collectionIds: string[],
): Promise<ActionResult> {
  if (!hasDatabase()) return NO_DB;
  try {
    await prisma.$transaction([
      prisma.productCollection.deleteMany({ where: { productId } }),
      ...(collectionIds.length
        ? [
            prisma.productCollection.createMany({
              data: collectionIds.map((collectionId) => ({
                productId,
                collectionId,
              })),
            }),
          ]
        : []),
    ]);
    revalidatePath(`/products/${productId}`);
    revalidatePath("/collections");
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (e) {
    console.error("[action] setProductCollections:", e);
    return { ok: false, reason: "error" };
  }
}

export async function markAllNotificationsRead(): Promise<ActionResult> {
  if (!hasDatabase()) return NO_DB;
  try {
    await prisma.notification.updateMany({
      where: { userId: USER_ID, read: false },
      data: { read: true },
    });
    revalidatePath("/notifications");
    return { ok: true };
  } catch (e) {
    console.error("[action] markAllNotificationsRead:", e);
    return { ok: false, reason: "error" };
  }
}
