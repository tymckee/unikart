import { prisma } from "../db";
import { formatPrice } from "../utils";
import type { Availability, NotificationType } from "../types";

/**
 * Price & stock tracking job.
 *
 * MVP uses a simulated "market" so the demo produces movement on demand. The
 * real implementation would replace `simulateMarketChange` with a re-parse of
 * the product page (src/lib/parser) — everything downstream (snapshots, product
 * update, alert evaluation, notifications) stays the same.
 *
 * Trigger it manually via the `runPriceCheckNow` server action, or on a
 * schedule via POST /api/jobs/price-check (see that route). This is the seam a
 * real cron/queue plugs into.
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

type MarketProduct = {
  currentPrice: number | null;
  lowestPrice: number | null;
  availability: string;
};

/** Stand-in "market": a bounded random walk. Replace with a live re-parse. */
function simulateMarketChange(p: MarketProduct): {
  price: number | null;
  availability: Availability;
} {
  let price = p.currentPrice;
  if (price != null) {
    const r = Math.random();
    if (r < 0.42) {
      const pct = 0.01 + Math.random() * 0.11; // drop 1–12%
      const floor = p.lowestPrice ?? price * 0.5;
      price = Math.max(floor, Math.round(price * (1 - pct) * 100) / 100);
    } else if (r < 0.67) {
      const pct = 0.01 + Math.random() * 0.07; // rise 1–8%
      price = Math.round(price * (1 + pct) * 100) / 100;
    }
  }

  let availability = p.availability as Availability;
  const a = Math.random();
  if (p.availability === "out_of_stock") {
    if (a < 0.5) availability = "in_stock";
  } else if (p.availability === "low_stock") {
    if (a < 0.3) availability = "in_stock";
    else if (a < 0.4) availability = "out_of_stock";
  } else if (p.availability === "in_stock") {
    if (a < 0.06) availability = "low_stock";
    else if (a < 0.09) availability = "out_of_stock";
  }

  return { price, availability };
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

export async function runPriceStockCheck(): Promise<CheckSummary> {
  const products = await prisma.product.findMany({
    where: { userId: USER_ID, isArchived: false, isPurchased: false },
    include: { alerts: { where: { enabled: true }, orderBy: { updatedAt: "desc" } } },
  });

  const now = new Date();
  let priceChanges = 0;
  let stockChanges = 0;
  const drafts: NotificationDraft[] = [];

  for (const p of products) {
    const { price, availability } = simulateMarketChange(p);
    const oldPrice = p.currentPrice;
    const oldAvail = p.availability;
    const priceChanged =
      price != null && oldPrice != null && Math.abs(price - oldPrice) > 0.001;
    const availChanged = availability !== oldAvail;

    // Each product's snapshots + update are atomic: it fully applies or rolls
    // back, so a mid-run failure can't leave the product out of sync or drop
    // the other products' notifications.
    try {
      await prisma.$transaction([
        // Save every check as snapshots (spec: every check is recorded).
        prisma.priceSnapshot.create({
          data: {
            productId: p.id,
            price: price ?? oldPrice ?? 0,
            currency: p.currency,
            source: "scheduled",
            checkedAt: now,
          },
        }),
        prisma.stockSnapshot.create({
          data: {
            productId: p.id,
            availability,
            source: "scheduled",
            checkedAt: now,
          },
        }),
        prisma.product.update({
          where: { id: p.id },
          data: {
            previousPrice: priceChanged ? oldPrice : p.previousPrice,
            currentPrice: price ?? oldPrice,
            lowestPrice:
              price != null
                ? Math.min(p.lowestPrice ?? price, price)
                : p.lowestPrice,
            highestPrice:
              price != null
                ? Math.max(p.highestPrice ?? price, price)
                : p.highestPrice,
            availability,
            lastCheckedAt: now,
          },
        }),
      ]);
    } catch (e) {
      console.error(`[job] check failed for ${p.id}:`, e);
      continue; // skip counts + notifications for this product
    }

    if (priceChanged) priceChanges++;
    if (availChanged) stockChanges++;
    drafts.push(
      ...buildNotifications(
        p,
        oldPrice,
        price,
        oldAvail,
        availability,
        p.alerts[0] ?? null,
      ),
    );
  }

  // Flush notifications for the products that did commit (best-effort).
  if (drafts.length) {
    try {
      await prisma.notification.createMany({ data: drafts });
    } catch (e) {
      console.error("[job] notification flush failed:", e);
    }
  }

  return {
    checked: products.length,
    priceChanges,
    stockChanges,
    notifications: drafts.length,
  };
}

export const priceStockCheckJob: Job<CheckSummary> = {
  name: "price-stock-check",
  run: runPriceStockCheck,
};
