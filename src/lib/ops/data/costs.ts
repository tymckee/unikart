/**
 * UniKart Ops — cost dashboard read access.
 *
 * Helps answer one question: "is UniKart getting expensive?" Source is the
 * CostLedgerEntry ledger (appended by recordCost / recordCostByRate), with
 * per-unit rates configurable via the SystemSetting "cost.rates" row (falling
 * back to DEFAULT_COST_RATES in src/lib/ops/cost.ts).
 *
 * IMPORTANT: every figure here is an *estimate* unless the underlying ledger row
 * is marked isEstimate:false. The page surfaces this prominently. We never
 * fabricate a number — when there's no ledger data we return zeros / empty and
 * the page shows a calm "no data yet" state (or a clearly-labelled demo chart).
 *
 * All reads guard hasDatabase() and try/catch, returning a safe fallback.
 */
import { hasDatabase, prisma } from "../../db";
import { DEFAULT_COST_RATES, type CostProvider, type CostCategory } from "../cost";
import { bucketSumByDay, topBy, DAY_MS } from "../metrics";
import type { ChartPoint, NamedValue } from "../types";

/* ---- Rates ---- */

export interface CostRate {
  key: string;
  provider: string;
  category: string;
  unit: string;
  unitCostUsd: number;
  note: string;
  /** True when the value came from SystemSetting, false when it's the default. */
  overridden: boolean;
}

/** A single editable rate value, as persisted in SystemSetting "cost.rates". */
type RateOverride = { unitCostUsd?: number };

/**
 * Current per-unit cost rates. Starts from DEFAULT_COST_RATES, then overlays any
 * overrides stored in SystemSetting "cost.rates" (valueJson is a JSON object of
 * { [key]: { unitCostUsd } }). Unknown keys in the override are ignored so the
 * catalog stays anchored to the code defaults.
 */
export async function getCostRates(): Promise<CostRate[]> {
  let overrides: Record<string, RateOverride> = {};
  if (hasDatabase()) {
    try {
      const row = await prisma.systemSetting.findUnique({
        where: { key: "cost.rates" },
        select: { valueJson: true },
      });
      if (row?.valueJson) {
        const parsed = JSON.parse(row.valueJson);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          overrides = parsed as Record<string, RateOverride>;
        }
      }
    } catch (e) {
      console.error("[ops] getCostRates failed:", e);
    }
  }

  return Object.entries(DEFAULT_COST_RATES).map(([key, def]) => {
    const ov = overrides[key];
    const overridden =
      !!ov && typeof ov.unitCostUsd === "number" && Number.isFinite(ov.unitCostUsd);
    return {
      key,
      provider: def.provider,
      category: def.category,
      unit: def.unit,
      unitCostUsd: overridden ? (ov!.unitCostUsd as number) : def.unitCostUsd,
      note: def.note,
      overridden,
    };
  });
}

/* ---- Dashboard ---- */

interface LedgerRow {
  provider: string;
  category: string;
  operation: string | null;
  estimatedCostUsd: number;
  isEstimate: boolean;
  userId: string | null;
  productId: string | null;
  occurredAt: Date;
}

export interface CostDashboard {
  /** True when there's no real ledger data — the page labels figures as demo. */
  isDemo: boolean;
  /** All ledger figures are estimates (configurable per-unit), unless a row opts out. */
  allEstimated: boolean;
  /** Daily estimated spend for the trend chart (last 30 days). */
  dailyTrend: ChartPoint[];
  /** Sum of estimated spend in the last 30 / 7 / today windows. */
  totals: { today: number; d7: number; d30: number; d60to30: number };
  /** Denominator counts for the per-X efficiency metrics. */
  denominators: {
    activeUsers: number;
    productsTracked: number;
    parserSuccesses: number;
    notifications: number;
  };
  /** Cost grouped by provider (last 30 days), for the donut. */
  byProvider: NamedValue[];
  /** Cost grouped by category (last 30 days). */
  byCategory: NamedValue[];
  /** Top cost-driving dimensions (last 30 days). */
  topUsers: NamedValue[];
  topProducts: NamedValue[];
  topDomains: NamedValue[];
}

const EMPTY_DASHBOARD: CostDashboard = {
  isDemo: true,
  allEstimated: true,
  dailyTrend: [],
  totals: { today: 0, d7: 0, d30: 0, d60to30: 0 },
  denominators: { activeUsers: 0, productsTracked: 0, parserSuccesses: 0, notifications: 0 },
  byProvider: [],
  byCategory: [],
  topUsers: [],
  topProducts: [],
  topDomains: [],
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Everything the Costs page needs in one read. Pulls the last 60 days of ledger
 * rows (so we can compute a prior-window delta), then derives totals, trend,
 * groupings, and the denominators for per-unit efficiency.
 */
export async function getCostDashboard(now = Date.now()): Promise<CostDashboard> {
  if (!hasDatabase()) return EMPTY_DASHBOARD;

  try {
    const since60 = new Date(now - 60 * DAY_MS);

    const [ledger, activeUsers, productsTracked, parserSuccesses, notifications] =
      await Promise.all([
        prisma.costLedgerEntry.findMany({
          where: { occurredAt: { gte: since60 } },
          select: {
            provider: true,
            category: true,
            operation: true,
            estimatedCostUsd: true,
            isEstimate: true,
            userId: true,
            productId: true,
            occurredAt: true,
          },
          orderBy: { occurredAt: "asc" },
          take: 50000,
        }),
        // Active users in the last 30 days (best-effort: lastActiveAt window).
        prisma.user
          .count({ where: { lastActiveAt: { gte: new Date(now - 30 * DAY_MS) } } })
          .catch(() => 0),
        // Products currently tracked (not archived, not released).
        prisma.product
          .count({ where: { isArchived: false, releasedAt: null } })
          .catch(() => 0),
        // Successful parses in the last 30 days (status column: success|partial|failed).
        prisma.parseAttempt
          .count({
            where: { status: "success", createdAt: { gte: new Date(now - 30 * DAY_MS) } },
          })
          .catch(() => 0),
        // Notifications sent in the last 30 days.
        prisma.notification
          .count({ where: { createdAt: { gte: new Date(now - 30 * DAY_MS) } } })
          .catch(() => 0),
      ]);

    const rows = ledger as LedgerRow[];

    if (rows.length === 0) {
      // No real ledger yet — keep the denominators (they may be real) but flag demo.
      return {
        ...EMPTY_DASHBOARD,
        denominators: { activeUsers, productsTracked, parserSuccesses, notifications },
      };
    }

    const cutoff30 = now - 30 * DAY_MS;
    const last30 = rows.filter((r) => r.occurredAt.getTime() >= cutoff30);

    const dailyTrend = bucketSumByDay(
      last30,
      (r) => r.occurredAt,
      (r) => r.estimatedCostUsd,
      30,
      now,
    );

    // Windowed sums (today / 7d / 30d), plus the prior 30d for the delta.
    const midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    const midnightMs = midnight.getTime();
    let today = 0;
    let d7 = 0;
    let d30 = 0;
    let d60to30 = 0;
    for (const r of rows) {
      const t = r.occurredAt.getTime();
      const v = r.estimatedCostUsd || 0;
      if (t >= midnightMs) today += v;
      if (t >= now - 7 * DAY_MS) d7 += v;
      if (t >= cutoff30) d30 += v;
      else if (t >= now - 60 * DAY_MS) d60to30 += v;
    }

    const sumValue = (r: LedgerRow) => r.estimatedCostUsd || 0;

    return {
      isDemo: false,
      allEstimated: rows.every((r) => r.isEstimate),
      dailyTrend,
      totals: {
        today: round(today),
        d7: round(d7),
        d30: round(d30),
        d60to30: round(d60to30),
      },
      denominators: { activeUsers, productsTracked, parserSuccesses, notifications },
      byProvider: topBy(last30, (r) => r.provider || "other", sumValue, 8),
      byCategory: topBy(last30, (r) => r.category || "other", sumValue, 8),
      topUsers: topBy(
        last30.filter((r) => r.userId),
        (r) => r.userId as string,
        sumValue,
        8,
      ),
      topProducts: topBy(
        last30.filter((r) => r.productId),
        (r) => r.productId as string,
        sumValue,
        8,
      ),
      // Domain isn't on the ledger row; we approximate "where cost comes from"
      // by operation (e.g. scrape_request, price_check). Honest about the proxy.
      topDomains: topBy(
        last30.filter((r) => r.operation),
        (r) => r.operation as string,
        sumValue,
        8,
      ),
    };
  } catch (e) {
    console.error("[ops] getCostDashboard failed:", e);
    return EMPTY_DASHBOARD;
  }
}

/* ---- CSV export source (raw ledger rows) ---- */

export interface CostExportRow {
  occurredAt: Date;
  provider: string;
  category: string;
  operation: string | null;
  quantity: number;
  unit: string;
  unitCostUsd: number;
  estimatedCostUsd: number;
  isEstimate: boolean;
}

/** Raw ledger rows for CSV export (newest first, capped). */
export async function getCostLedgerForExport(limit = 50000): Promise<CostExportRow[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await prisma.costLedgerEntry.findMany({
      select: {
        occurredAt: true,
        provider: true,
        category: true,
        operation: true,
        quantity: true,
        unit: true,
        unitCostUsd: true,
        estimatedCostUsd: true,
        isEstimate: true,
      },
      orderBy: { occurredAt: "desc" },
      take: limit,
    });
    return rows as CostExportRow[];
  } catch (e) {
    console.error("[ops] getCostLedgerForExport failed:", e);
    return [];
  }
}

/** Reference list of all valid providers / categories (for any UI hints). */
export const COST_PROVIDERS: CostProvider[] = [
  "anthropic",
  "scraperapi",
  "resend",
  "stripe",
  "neon",
  "netlify",
  "cloudflare",
  "other",
];

export const COST_CATEGORIES: CostCategory[] = [
  "hosting",
  "database",
  "storage",
  "email",
  "parser",
  "price_check",
  "stock_check",
  "ai",
  "image",
  "stripe_fees",
  "affiliate",
  "other",
];
