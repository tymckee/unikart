/**
 * UniKart Ops — cost tracking.
 *
 * `recordCost()` appends a CostLedgerEntry. Where exact provider invoices aren't
 * available programmatically, we use configurable per-unit estimates (labelled
 * as estimates in the UI via COST_ESTIMATE_MODE). Real, confirmed rates can be
 * passed with `isEstimate: false`.
 *
 * Default rates can be overridden at runtime by SystemSetting rows (category
 * "costs"); see src/lib/ops/data/costs.ts (resolved by the Costs page).
 *
 * Best-effort — never throws into the caller.
 */
import { hasDatabase, prisma } from "../db";
import { safeJson } from "./sanitize";
import { costEstimateMode } from "./env";

export type CostProvider =
  | "anthropic"
  | "scraperapi"
  | "resend"
  | "stripe"
  | "neon"
  | "netlify"
  | "cloudflare"
  | "other";

export type CostCategory =
  | "hosting"
  | "database"
  | "storage"
  | "email"
  | "parser"
  | "price_check"
  | "stock_check"
  | "ai"
  | "image"
  | "stripe_fees"
  | "affiliate"
  | "other";

/**
 * Default per-unit cost estimates (USD). These are deliberately conservative
 * starting points — tune them on the Costs page (persisted as SystemSetting).
 * Unit is documented per entry.
 */
export const DEFAULT_COST_RATES: Record<
  string,
  { provider: CostProvider; category: CostCategory; unit: string; unitCostUsd: number; note: string }
> = {
  ai_gist: { provider: "anthropic", category: "ai", unit: "request", unitCostUsd: 0.002, note: "Claude Haiku 'the gist' per product (est.)" },
  scrape_request: { provider: "scraperapi", category: "parser", unit: "request", unitCostUsd: 0.001, note: "ScraperAPI credit per scrape (est.)" },
  price_check: { provider: "scraperapi", category: "price_check", unit: "check", unitCostUsd: 0.001, note: "One scheduled price re-check (est.)" },
  stock_check: { provider: "scraperapi", category: "stock_check", unit: "check", unitCostUsd: 0.001, note: "One stock re-check (est.)" },
  email_send: { provider: "resend", category: "email", unit: "email", unitCostUsd: 0.0004, note: "Resend transactional email (est.)" },
  db_compute_hour: { provider: "neon", category: "database", unit: "hour", unitCostUsd: 0.16, note: "Neon compute hour (est.)" },
  hosting_month: { provider: "netlify", category: "hosting", unit: "month", unitCostUsd: 0, note: "Netlify (free tier — set when on a paid plan)" },
  stripe_fee: { provider: "stripe", category: "stripe_fees", unit: "charge", unitCostUsd: 0.45, note: "Stripe per-charge fee on a $5 sub (2.9% + 30¢, est.)" },
};

export interface CostInput {
  provider: CostProvider | (string & {});
  category: CostCategory | (string & {});
  service?: string | null;
  operation?: string | null;
  quantity?: number;
  unit?: string;
  unitCostUsd?: number;
  estimatedCostUsd?: number;
  isEstimate?: boolean;
  userId?: string | null;
  productId?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown> | null;
  occurredAt?: Date;
}

/** Append a cost ledger entry. Computes estimatedCostUsd if not supplied. */
export async function recordCost(input: CostInput): Promise<void> {
  if (!hasDatabase()) return;
  try {
    const quantity = input.quantity ?? 1;
    const unitCostUsd = input.unitCostUsd ?? 0;
    const estimated =
      input.estimatedCostUsd ?? Math.round(quantity * unitCostUsd * 1e6) / 1e6;
    await prisma.costLedgerEntry.create({
      data: {
        provider: input.provider,
        category: input.category,
        service: input.service ?? null,
        operation: input.operation ?? null,
        quantity,
        unit: input.unit ?? "request",
        unitCostUsd,
        estimatedCostUsd: estimated,
        isEstimate: input.isEstimate ?? costEstimateMode(),
        userId: input.userId ?? null,
        productId: input.productId ?? null,
        requestId: input.requestId ?? null,
        metadataJson: safeJson(input.metadata),
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
  } catch (e) {
    console.error("[ops] recordCost failed:", e);
  }
}

/** Record a cost using a named default rate (the common path). */
export async function recordCostByRate(
  rateKey: keyof typeof DEFAULT_COST_RATES,
  quantity = 1,
  extra: Partial<CostInput> = {},
): Promise<void> {
  const rate = DEFAULT_COST_RATES[rateKey];
  if (!rate) return;
  await recordCost({
    provider: rate.provider,
    category: rate.category,
    operation: String(rateKey),
    unit: rate.unit,
    unitCostUsd: rate.unitCostUsd,
    quantity,
    isEstimate: true,
    ...extra,
  });
}
