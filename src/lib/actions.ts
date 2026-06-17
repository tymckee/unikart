"use server";

import { revalidatePath } from "next/cache";
import { hasDatabase, prisma } from "./db";
import { getCurrentUser, getCurrentUserId } from "./auth-helpers";
import { parseProduct } from "./parser";
import { enrichProduct } from "./enrich";
import { getCutout } from "./cutout";
import { summarizeProduct, type ProductGist } from "./ai/gist";
import { runPriceStockCheck } from "./jobs/price-stock";
import type { ParsePreview } from "./parse-preview";
import type { Availability, MetadataConfidence } from "./types";

/** Read a product preview from a pasted URL (server-side fetch + parse). Kept
 * fast — just the fetch/scrape — so the paste→preview round-trip stays well
 * under the serverless function timeout. The AI name-cleanup + gist run in
 * saveProduct (a separate request), so we don't chain two ~5s network calls
 * (ScraperAPI + Claude) into one action. */
export async function parseProductUrl(url: string): Promise<ParsePreview> {
  return parseProduct(url);
}

/** Best-effort AI normalization: a clean name + cached gist from whatever we
 * captured. Returns the (possibly cleaned) title and the gist JSON to store. */
async function normalizeForSave(
  input: SaveProductInput,
): Promise<{ title: string; gistJson: string | null }> {
  const title = input.title.trim();
  try {
    const pageText =
      input.rawMetadata && typeof input.rawMetadata.pageText === "string"
        ? input.rawMetadata.pageText
        : null;
    const description = (pageText || input.description || "").slice(0, 3000);
    const gist = await summarizeProduct({
      title,
      description,
      brand: input.brand,
      category: input.category,
      storeName: input.storeName,
    });
    if (!gist) return { title, gistJson: null };
    const cleanName = gist.cleanName?.trim();
    return {
      title: cleanName && cleanName.length >= 3 ? cleanName : title,
      gistJson: JSON.stringify(gist),
    };
  } catch (e) {
    console.error("[action] normalizeForSave:", e);
    return { title, gistJson: null };
  }
}

/**
 * Manually run the price/stock check (the "Run check now" button). Always real
 * data: it scrapes each product via fetchLivePrice (inside runPriceStockCheck)
 * and applies the result with applyPriceCheck.
 *
 * In production we keep the batch SMALL (a few oldest-checked products) so the
 * scrape stays under Netlify's 10s function cap — the full sweep runs on the
 * 6-hour scheduled function. Locally there's no timeout, so we check more.
 */
export async function runPriceCheckNow(): Promise<
  ActionResult<{ priceChanges: number; stockChanges: number; notifications: number }>
> {
  if (!hasDatabase()) return NO_DB;
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NO_AUTH;
    const limit = process.env.NODE_ENV === "production" ? 3 : 40;
    const s = await runPriceStockCheck(limit, userId);
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
  | {
      ok: false;
      reason: "no-database" | "not-found" | "error" | "unauthorized";
      message?: string;
    };

const NO_DB = { ok: false, reason: "no-database" } as const;
const NO_AUTH = { ok: false, reason: "unauthorized" } as const;

/**
 * Free plan cap: at most this many *active* saved items (not archived, not
 * released). Pro is unlimited. This is the single product gate — see
 * requirePro() in auth-helpers and the upgrade card in Settings. Kept internal
 * (not exported) because this is a "use server" module where only async
 * functions may be exported.
 */
const FREE_ACTIVE_PRODUCT_LIMIT = 15;

function revalidateAll() {
  revalidatePath("/dashboard");
  revalidatePath("/collections");
  revalidatePath("/cart");
  revalidatePath("/notifications");
}

async function getOrCreateActiveCartId(userId: string): Promise<string> {
  const existing = await prisma.universalCart.findFirst({
    where: { userId, status: "active" },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.universalCart.create({
    data: { userId, name: "Universal Cart", status: "active" },
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
    const user = await getCurrentUser();
    if (!user) return NO_AUTH;
    const userId = user.id;

    // Free-plan cap: free users may track at most FREE_ACTIVE_PRODUCT_LIMIT
    // active items (non-archived, non-released). Pro is unlimited.
    if (user.plan !== "pro") {
      const activeCount = await prisma.product.count({
        where: { userId, isArchived: false, releasedAt: null },
      });
      if (activeCount >= FREE_ACTIVE_PRODUCT_LIMIT) {
        return {
          ok: false,
          reason: "error",
          message: `Free plan is limited to ${FREE_ACTIVE_PRODUCT_LIMIT} saved items — upgrade to Pro for unlimited.`,
        };
      }
    }

    const currency = input.currency ?? "USD";
    const price = input.price ?? null;
    const { title, gistJson } = await normalizeForSave(input);
    const product = await prisma.product.create({
      data: {
        userId,
        title,
        gist: gistJson,
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
                    userId,
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
        where: { id: input.collectionId, userId },
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

    // Kick off background enrichment (slow scrape → real price/image/specs).
    await triggerEnrichment({
      productId: product.id,
      originalUrl: input.originalUrl,
      title,
      brand: input.brand,
      category: input.category,
      storeName: input.storeName,
    });

    revalidateAll();
    return { ok: true, data: { id: product.id } };
  } catch (e) {
    console.error("[action] saveProduct:", e);
    return { ok: false, reason: "error" };
  }
}

/**
 * Fill in real price/image/specs after save. In production we hand off to a
 * Netlify Background Function (15-min budget — the scrape can take 5–16s, well
 * over the 10s request limit) and return immediately. Locally (or with no site
 * URL) there's no timeout, so we just run it inline.
 */
interface EnrichTrigger {
  productId: string;
  originalUrl: string;
  title: string;
  brand?: string | null;
  category?: string | null;
  storeName?: string | null;
}

async function triggerEnrichment(input: EnrichTrigger): Promise<void> {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (process.env.NODE_ENV === "production" && base) {
    try {
      await fetch(`${base}/.netlify/functions/enrich-product-background`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...input, secret: process.env.CRON_SECRET }),
      });
    } catch (e) {
      console.error("[action] enrich trigger:", e);
    }
  } else {
    try {
      await enrichProduct(input.productId);
    } catch (e) {
      console.error("[action] enrich inline:", e);
    }
  }
}

export async function addToCart(productId: string): Promise<ActionResult> {
  if (!hasDatabase()) return NO_DB;
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NO_AUTH;
    // Only the owner can add their own product to their cart.
    const product = await prisma.product.findFirst({
      where: { id: productId, userId },
      select: { availability: true },
    });
    if (!product) return { ok: false, reason: "not-found" };
    const cartId = await getOrCreateActiveCartId(userId);
    await prisma.universalCartItem.upsert({
      where: { cartId_productId: { cartId, productId } },
      create: {
        cartId,
        productId,
        merchantStatus: product.availability ?? "unknown",
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
    const userId = await getCurrentUserId();
    if (!userId) return NO_AUTH;
    // Scope the delete to items in the caller's own carts (IDOR guard).
    await prisma.universalCartItem.deleteMany({
      where: { id: itemId, cart: { userId } },
    });
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
    const userId = await getCurrentUserId();
    if (!userId) return NO_AUTH;
    const cart = await prisma.universalCart.findFirst({
      where: { userId, status: "active" },
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
    const userId = await getCurrentUserId();
    if (!userId) return NO_AUTH;
    // The product must belong to the caller before we touch its alerts.
    const owned = await prisma.product.findFirst({
      where: { id: productId, userId },
      select: { id: true },
    });
    if (!owned) return { ok: false, reason: "not-found" };
    const existing = await prisma.alertRule.findFirst({
      where: { productId, userId },
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
          userId,
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
    const userId = await getCurrentUserId();
    if (!userId) return NO_AUTH;
    const { count } = await prisma.product.updateMany({
      where: { id: productId, userId },
      data: { isPurchased: true, purchasedAt: new Date() },
    });
    if (!count) return { ok: false, reason: "not-found" };
    await prisma.universalCartItem.deleteMany({
      where: { productId, cart: { userId } },
    });
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
    const userId = await getCurrentUserId();
    if (!userId) return NO_AUTH;
    const { count } = await prisma.product.updateMany({
      where: { id: productId, userId },
      data: { isArchived: true },
    });
    if (!count) return { ok: false, reason: "not-found" };
    revalidateAll();
    return { ok: true };
  } catch (e) {
    console.error("[action] archiveProduct:", e);
    return { ok: false, reason: "error" };
  }
}

/**
 * Release a product: consciously let go of the urge to buy. This is a calm,
 * guilt-free act — distinct from Archive (filing away) and Delete (erasing).
 * We stamp releasedAt and quietly remove it from the active cart so it leaves
 * the active Hub without lingering as an intent-to-buy.
 */
export async function releaseProduct(productId: string): Promise<ActionResult> {
  if (!hasDatabase()) return NO_DB;
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NO_AUTH;
    const { count } = await prisma.product.updateMany({
      where: { id: productId, userId },
      data: { releasedAt: new Date() },
    });
    if (!count) return { ok: false, reason: "not-found" };
    // No longer something you're planning to buy — clear it from the cart.
    await prisma.universalCartItem.deleteMany({
      where: { productId, cart: { userId } },
    });
    revalidateAll();
    return { ok: true };
  } catch (e) {
    console.error("[action] releaseProduct:", e);
    return { ok: false, reason: "error" };
  }
}

/** Undo a release — bring it back into consideration. */
export async function unreleaseProduct(
  productId: string,
): Promise<ActionResult> {
  if (!hasDatabase()) return NO_DB;
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NO_AUTH;
    const { count } = await prisma.product.updateMany({
      where: { id: productId, userId },
      data: { releasedAt: null },
    });
    if (!count) return { ok: false, reason: "not-found" };
    revalidateAll();
    return { ok: true };
  } catch (e) {
    console.error("[action] unreleaseProduct:", e);
    return { ok: false, reason: "error" };
  }
}

export async function updateNotes(
  productId: string,
  notes: string,
): Promise<ActionResult> {
  if (!hasDatabase()) return NO_DB;
  try {
    const userId = await getCurrentUserId();
    if (!userId) return NO_AUTH;
    const { count } = await prisma.product.updateMany({
      where: { id: productId, userId },
      data: { notes },
    });
    if (!count) return { ok: false, reason: "not-found" };
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
    const userId = await getCurrentUserId();
    if (!userId) return NO_AUTH;
    const last = await prisma.collection.findFirst({
      where: { userId },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });
    const created = await prisma.collection.create({
      data: {
        userId,
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
    const userId = await getCurrentUserId();
    if (!userId) return NO_AUTH;
    const existing = await prisma.product.findFirst({
      where: { id: productId, userId },
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
    const userId = await getCurrentUserId();
    if (!userId) return NO_AUTH;
    const p = await prisma.product.findFirst({
      where: { id: productId, userId },
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
    const userId = await getCurrentUserId();
    if (!userId) return NO_AUTH;
    // The product must be the caller's, and we only attach collections they own.
    const owned = await prisma.product.findFirst({
      where: { id: productId, userId },
      select: { id: true },
    });
    if (!owned) return { ok: false, reason: "not-found" };
    const ownedCollections = collectionIds.length
      ? await prisma.collection.findMany({
          where: { id: { in: collectionIds }, userId },
          select: { id: true },
        })
      : [];
    const validIds = ownedCollections.map((c) => c.id);
    await prisma.$transaction([
      prisma.productCollection.deleteMany({ where: { productId } }),
      ...(validIds.length
        ? [
            prisma.productCollection.createMany({
              data: validIds.map((collectionId) => ({
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
    const userId = await getCurrentUserId();
    if (!userId) return NO_AUTH;
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    revalidatePath("/notifications");
    return { ok: true };
  } catch (e) {
    console.error("[action] markAllNotificationsRead:", e);
    return { ok: false, reason: "error" };
  }
}
