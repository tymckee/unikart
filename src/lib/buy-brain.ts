import type { BuyVerdict, PriceSnapshot, Product } from "./types";

export interface BuyBrainResult {
  verdict: BuyVerdict;
  headline: string;
  reason: string;
  /** 0–1 model confidence in the signal. */
  confidence: number;
}

/** Average of the most recent N price snapshots. */
function recentAverage(history: PriceSnapshot[], n = 8): number | null {
  if (!history.length) return null;
  const recent = [...history].slice(-n);
  return recent.reduce((s, p) => s + p.price, 0) / recent.length;
}

/** Coefficient of variation — a simple volatility proxy. */
function volatility(history: PriceSnapshot[]): number {
  if (history.length < 2) return 0;
  const prices = history.map((p) => p.price);
  const mean = prices.reduce((s, p) => s + p, 0) / prices.length;
  if (mean === 0) return 0;
  const variance =
    prices.reduce((s, p) => s + (p - mean) ** 2, 0) / prices.length;
  return Math.sqrt(variance) / mean;
}

/**
 * Deterministic Buy / Wait / Watch Signal.
 * MVP logic — structured so an AI model can replace it later
 * behind the same interface.
 */
export function buyBrain(
  product: Pick<
    Product,
    | "currentPrice"
    | "lowestPrice"
    | "highestPrice"
    | "availability"
    | "currency"
  >,
  history: PriceSnapshot[] = [],
  targetPrice?: number | null,
): BuyBrainResult {
  const price = product.currentPrice;

  if (product.availability === "out_of_stock" || price == null) {
    return {
      verdict: "watch",
      headline: "Watch",
      reason:
        product.availability === "out_of_stock"
          ? "Out of stock right now. We'll watch for it to return."
          : "No live price yet. We'll keep an eye on it.",
      confidence: 0.6,
    };
  }

  const avg = recentAverage(history);
  const vol = volatility(history);
  const low = product.lowestPrice ?? price;

  // Target price reached — strongest buy signal.
  if (targetPrice != null && price <= targetPrice) {
    return {
      verdict: "buy",
      headline: "Buy now",
      reason: `At or below your target of ${formatLite(targetPrice, product.currency)}.`,
      confidence: 0.92,
    };
  }

  // At/near the lowest we've ever seen.
  if (price <= low * 1.02) {
    return {
      verdict: "buy",
      headline: "Buy now",
      reason: "Near the lowest price we've tracked.",
      confidence: 0.85,
    };
  }

  // Meaningfully below recent average.
  if (avg != null && price < avg * 0.95) {
    return {
      verdict: "buy",
      headline: "Good time",
      reason: "Below its recent average — a fair window to buy.",
      confidence: 0.74,
    };
  }

  // Above recent average — likely to settle.
  if (avg != null && price > avg * 1.05) {
    return {
      verdict: "wait",
      headline: "Wait",
      reason: "Above its recent average. Prices like this tend to ease.",
      confidence: 0.7,
    };
  }

  // Volatile pricing — worth watching for a dip.
  if (vol > 0.08) {
    return {
      verdict: "watch",
      headline: "Watch",
      reason: "Price has been moving. Watch for a dip.",
      confidence: 0.66,
    };
  }

  return {
    verdict: "watch",
    headline: "Watch",
    reason: "Price is holding steady. No reason to rush.",
    confidence: 0.6,
  };
}

function formatLite(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}
