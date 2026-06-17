import { prisma } from "../db";
import { Prisma } from "../../generated/prisma";
import { formatPrice } from "../utils";
import { fetchLivePrice } from "../track-compute";
import type { NotificationType } from "../types";

/**
 * Price & stock tracking job.
 *
 * The live data SOURCE is a real scrape: the scheduled Netlify function calls
 * fetchLivePrice (src/lib/track-compute.ts, Prisma-free) and POSTs the result
 * to /api/track/apply, which calls applyPriceCheck below. The per-product apply
 * logic (snapshots, product update, alert evaluation, notifications) is shared:
 * both that route and the manual `runPriceStockCheck` path call applyPriceCheck.
 *
 * `runPriceStockCheck` is kept for the manual "Run check now" path: in dev it
 * scrapes each tracked product inline; with no real price it records a check
 * without a fabricated price.
 */

const USER_ID = "user_1";

export interface Job<T> {
  name: string;
  run: () => Promise<T>;
}

export interface CheckSummary {
  checked: number;
  priceChanges: number;
  stockChanges: number;
  notifications: number;
}

interface NotificationDraft {
  userId: string;
  productId: string;
  type: NotificationType;
  title: string;
  body: string;
}

/** Change-based notifications (only fire on an actual change/crossing). */
function buildNotifications(
  product: {
    id: string;
    title: string;
    currency: string;
  },
  oldPrice: number | null,
  newPrice: number | null,
  oldAvail: string,
  newAvail: string,
  alert: { type: string; targetPrice: number | null; enabled: boolean } | null,
): NotificationDraft[] {
  const out: NotificationDraft[] = [];
  const base = { userId: USER_ID, productId: product.id };
  const cur = (n: number) => formatPrice(n, product.currency);

  if (newPrice != null && oldPrice != null && Math.abs(newPrice - oldPrice) > 0.001) {
    const pct = ((newPrice - oldPrice) / oldPrice) * 100;
    if (newPrice < oldPrice) {
      out.push({
        ...base,
        type: "price_dropped",
        title: `Price dropped on ${product.title}`,
        body: `Now ${cur(newPrice)} — down ${cur(oldPrice - newPrice)} (${Math.abs(Math.round(pct))}%).`,
      });
    } else if (pct > 3) {
      out.push({
        ...base,
        type: "price_increased",
        title: `Price increased on ${product.title}`,
        body: `Up to ${cur(newPrice)} (${Math.round(pct)}%).`,
      });
    }
  }

  // Target reached — only when newly crossing the threshold.
  if (
    alert?.enabled &&
    alert.type === "target_price" &&
    alert.targetPrice != null &&
    newPrice != null &&
    newPrice <= alert.targetPrice &&
    (oldPrice == null || oldPrice > alert.targetPrice)
  ) {
    out.push({
      ...base,
      type: "target_reached",
      title: `Target reached: ${product.title}`,
      body: `Now ${cur(newPrice)} — at or below your ${cur(alert.targetPrice)} target.`,
    });
  }

  // Stock transitions.
  if (oldAvail !== newAvail) {
    if (newAvail === "out_of_stock") {
      out.push({
        ...base,
        type: "out_of_stock",
        title: `Out of stock: ${product.title}`,
        body: `It just sold out. We'll watch for it to return.`,
      });
    } else if (oldAvail === "out_of_stock") {
      out.push({
        ...base,
        type: "back_in_stock",
        title: `Back in stock: ${product.title}`,
        body: `${product.title} is available again${newPrice != null ? ` at ${cur(newPrice)}` : ""}.`,
      });
    }
  }

  return out;
}

export interface ApplyResult {
  priceChanged: boolean;
  stockChanged: boolean;
  notifications: number;
}

/**
 * Record one product's check result (Prisma). Shared by the scheduled apply
 * route and the manual `runPriceStockCheck`. Records the snapshot(s), updates
 * previousPrice/current/lowest/highest + availability + lastCheckedAt, and
 * creates change-based notifications. When `next.price` is null we still update
 * lastCheckedAt + availability (and record a stock snapshot) but skip the price
 * snapshot — we never invent a number.
 *
 * Each product's writes are atomic: they fully apply or roll back, so a failure
 * can't leave a product half-updated.
 */
export async function applyPriceCheck(
  productId: string,
  next: { price: number | null; availability: string },
): Promise<ApplyResult> {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    include: { alerts: { where: { enabled: true }, orderBy: { updatedAt: "desc" } } },
  });
  if (!p) return { priceChanged: false, stockChanged: false, notifications: 0 };

  const now = new Date();
  const price = next.price;
  const availability = next.availability || p.availability;
  const oldPrice = p.currentPrice;
  const oldAvail = p.availability;
  const priceChanged =
    price != null && oldPrice != null && Math.abs(price - oldPrice) > 0.001;
  const availChanged = availability !== oldAvail;

  const writes: Prisma.PrismaPromise<unknown>[] = [];
  // Only record a price snapshot when we have a REAL price (no fabrication).
  if (price != null) {
    writes.push(
      prisma.priceSnapshot.create({
        data: {
          productId: p.id,
          price,
          currency: p.currency,
          source: "scheduled",
          checkedAt: now,
        },
      }),
    );
  }
  // Stock snapshot: every check is recorded (availability is always known-ish).
  writes.push(
    prisma.stockSnapshot.create({
      data: {
        productId: p.id,
        availability,
        source: "scheduled",
        checkedAt: now,
      },
    }),
  );
  writes.push(
    prisma.product.update({
      where: { id: p.id },
      data: {
        previousPrice: priceChanged ? oldPrice : p.previousPrice,
        currentPrice: price ?? oldPrice,
        lowestPrice:
          price != null ? Math.min(p.lowestPrice ?? price, price) : p.lowestPrice,
        highestPrice:
          price != null ? Math.max(p.highestPrice ?? price, price) : p.highestPrice,
        availability,
        lastCheckedAt: now,
      },
    }),
  );

  await prisma.$transaction(writes);

  const drafts = buildNotifications(
    p,
    oldPrice,
    price,
    oldAvail,
    availability,
    p.alerts[0] ?? null,
  );
  if (drafts.length) {
    try {
      await prisma.notification.createMany({ data: drafts });
    } catch (e) {
      console.error(`[job] notification flush failed for ${p.id}:`, e);
    }
  }

  return {
    priceChanged,
    stockChanged: availChanged,
    notifications: drafts.length,
  };
}

/**
 * Manual path ("Run check now"): scrape each tracked product inline via
 * fetchLivePrice (real data; dev-simulated only when no SCRAPERAPI_KEY in
 * non-prod) and apply via applyPriceCheck. Bounded so it can't run unbounded.
 */
export async function runPriceStockCheck(limit = 40): Promise<CheckSummary> {
  const products = await prisma.product.findMany({
    where: {
      userId: USER_ID,
      isArchived: false,
      isPurchased: false,
      releasedAt: null,
    },
    orderBy: [{ lastCheckedAt: { sort: "asc", nulls: "first" } }],
    take: limit,
    select: { id: true, originalUrl: true, storeDomain: true },
  });

  let priceChanges = 0;
  let stockChanges = 0;
  let notifications = 0;

  for (const p of products) {
    try {
      const next = await fetchLivePrice({
        originalUrl: p.originalUrl,
        storeDomain: p.storeDomain,
      });
      const r = await applyPriceCheck(p.id, next);
      if (r.priceChanged) priceChanges++;
      if (r.stockChanged) stockChanges++;
      notifications += r.notifications;
    } catch (e) {
      console.error(`[job] check failed for ${p.id}:`, e);
      continue;
    }
  }

  return {
    checked: products.length,
    priceChanges,
    stockChanges,
    notifications,
  };
}

export const priceStockCheckJob: Job<CheckSummary> = {
  name: "price-stock-check",
  run: runPriceStockCheck,
};
