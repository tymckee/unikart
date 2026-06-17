/**
 * UniKart Ops — Overview (command center) data access.
 *
 * getOverview() gathers everything the /ops dashboard renders in a single
 * parallel pass. Each piece is independently guarded (hasDatabase + try/catch)
 * so one failing query never blanks the whole page — it falls back to a safe
 * zero/empty value, and the page labels anything that is demo/fallback honestly
 * (DemoBadge / isDemo). We never fabricate a real number.
 *
 * Server-only (imports prisma). Consumed by the Overview server page.
 */
import { hasDatabase, prisma } from "../../db";
import {
  bucketByDay,
  bucketSuccessFailByDay,
  bucketSumByDay,
  delta,
  demoSeries,
  rate,
  windowCounts,
  DAY_MS,
} from "../metrics";
import type {
  ChartPoint,
  MetricDelta,
  ServiceHealth,
  SystemStatus,
} from "../types";

/**
 * Canonical UniKart Coast list price (USD/month). The real charged amount lives
 * in Stripe; this is the published price used to *estimate* MRR from the count
 * of active subscriptions. Annual plans are normalized to a monthly figure.
 * Source of truth for the displayed price: PlanBillingCard ("$5/month",
 * "$49/year").
 */
const COAST_MONTHLY_USD = 5;
const COAST_ANNUAL_MONTHLY_USD = 49 / 12;

/** Subscription statuses that count as "actively paying" for MRR. */
const ACTIVE_SUB_STATUSES = ["active", "trialing"] as const;

export interface OverviewWindow {
  today: number;
  d7: number;
  d30: number;
}

export interface OverviewData {
  /** True only when there is no database configured at all. */
  noDatabase: boolean;

  /* Users */
  totalUsers: number;
  newUsers: OverviewWindow;
  newUsersDelta: MetricDelta;
  activeUsers: OverviewWindow;
  /** True when lastActiveAt is essentially never populated (be honest about it). */
  activeUsersSparse: boolean;

  /* Products */
  totalProducts: number;
  newProducts: OverviewWindow;
  newProductsDelta: MetricDelta;
  trackedProducts: number;
  purchasedProducts: number;
  releasedProducts: number;

  /* Parser (last 30d) */
  parser: {
    total: number;
    successRate: number;
    failureRate: number;
    avgConfidenceLabel: string;
    isDemo: boolean;
  };

  /* Tracking jobs */
  priceChecksScheduled: number;
  stockChecks: number;

  /* Notifications */
  notificationsTotal: number;
  notificationsRead: number;
  notificationsDeliveredRate: number;

  /* Universal Cart */
  cartItemsActive: number;

  /* Checkout Assistant (analytics) */
  checkout: {
    started: number;
    completed: number;
    isDemo: boolean;
  };

  /* Costs (last 30d) */
  cost: {
    last30dUsd: number;
    isDemo: boolean;
  };

  /* Billing */
  mrrUsd: number;
  mrrIsPlaceholder: boolean;
  coastUsers: number;

  /* Jobs */
  jobFailures7d: number;

  /* System */
  systemStatus: SystemStatus;
  services: ServiceHealth[];

  /* Charts (30-day windows) */
  charts: {
    signups: ChartPoint[];
    productsSaved: ChartPoint[];
    parser: ChartPoint[];
    parserIsDemo: boolean;
    cost: ChartPoint[];
    costIsDemo: boolean;
    notifications: ChartPoint[];
  };
}

const CHART_DAYS = 30;

/** Safe wrapper: run a query, log + fall back to `fallback` on any error. */
async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  if (!hasDatabase()) return fallback;
  try {
    return await fn();
  } catch (e) {
    console.error("[ops] overview." + label + ":", e);
    return fallback;
  }
}

const CONFIDENCE_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };
const CONFIDENCE_LABEL: Record<number, string> = { 3: "High", 2: "Medium", 1: "Low" };

function avgConfidenceLabel(confidences: (string | null)[]): string {
  const ranks = confidences
    .map((c) => (c ? CONFIDENCE_RANK[c] : undefined))
    .filter((n): n is number => typeof n === "number");
  if (ranks.length === 0) return "—";
  const avg = Math.round(ranks.reduce((s, n) => s + n, 0) / ranks.length);
  return CONFIDENCE_LABEL[Math.min(3, Math.max(1, avg))] ?? "—";
}

/**
 * The whole dashboard, gathered in parallel. Returns calm, honest fallbacks
 * (zeros / empty / clearly-marked demo) rather than throwing.
 */
export async function getOverview(now = Date.now()): Promise<OverviewData> {
  const noDatabase = !hasDatabase();

  const since30 = new Date(now - 30 * DAY_MS);
  const since60 = new Date(now - 60 * DAY_MS);
  const since7 = new Date(now - 7 * DAY_MS);

  const [
    userDates,
    activeDates,
    totalUsers,
    productRows,
    trackedProducts,
    purchasedProducts,
    releasedProducts,
    parseAttempts,
    priceChecksScheduled,
    stockChecks,
    notificationRows,
    notificationsRead,
    notificationsTotal,
    cartItemsActive,
    checkoutEvents,
    costEntries,
    cost30Sum,
    cost30PrevSum,
    activeSubs,
    coastUsers,
    jobFailures7d,
  ] = await Promise.all([
    // user.createdAt (for signups window + chart). Exclude internal/test from counts is intentional? Keep all — internal flagged separately elsewhere; here we report platform reality but drop test accounts.
    safe(
      "userDates",
      () =>
        prisma.user.findMany({
          where: { isTestAccount: false },
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 5000,
        }),
      [] as { createdAt: Date }[],
    ),
    // user.lastActiveAt (active window).
    safe(
      "activeDates",
      () =>
        prisma.user.findMany({
          where: { isTestAccount: false, lastActiveAt: { not: null } },
          select: { lastActiveAt: true },
          orderBy: { lastActiveAt: "desc" },
          take: 5000,
        }),
      [] as { lastActiveAt: Date | null }[],
    ),
    safe("totalUsers", () => prisma.user.count({ where: { isTestAccount: false } }), 0),
    // product.createdAt + flags (window + chart + tracked breakdown).
    safe(
      "productRows",
      () =>
        prisma.product.findMany({
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 10000,
        }),
      [] as { createdAt: Date }[],
    ),
    safe(
      "trackedProducts",
      () =>
        prisma.product.count({
          where: { isArchived: false, isPurchased: false, releasedAt: null },
        }),
      0,
    ),
    safe("purchasedProducts", () => prisma.product.count({ where: { isPurchased: true } }), 0),
    safe("releasedProducts", () => prisma.product.count({ where: { releasedAt: { not: null } } }), 0),
    // ParseAttempt last 30d (success rate + confidence + chart).
    safe(
      "parseAttempts",
      () =>
        prisma.parseAttempt.findMany({
          where: { createdAt: { gte: since30 } },
          select: { status: true, confidence: true, createdAt: true },
          take: 20000,
        }),
      [] as { status: string; confidence: string | null; createdAt: Date }[],
    ),
    // Scheduled price checks (real runs, not seeded mock).
    safe(
      "priceChecksScheduled",
      () => prisma.priceSnapshot.count({ where: { source: "scheduled" } }),
      0,
    ),
    safe("stockChecks", () => prisma.stockSnapshot.count(), 0),
    // Notifications over time (chart).
    safe(
      "notificationRows",
      () =>
        prisma.notification.findMany({
          select: { createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 10000,
        }),
      [] as { createdAt: Date }[],
    ),
    safe("notificationsRead", () => prisma.notification.count({ where: { read: true } }), 0),
    safe("notificationsTotal", () => prisma.notification.count(), 0),
    // Universal Cart items in active carts.
    safe(
      "cartItemsActive",
      () => prisma.universalCartItem.count({ where: { cart: { status: "active" } } }),
      0,
    ),
    // Checkout Assistant analytics events.
    safe(
      "checkoutEvents",
      () =>
        prisma.analyticsEvent.findMany({
          where: {
            eventName: { in: ["checkout_assistant_started", "checkout_assistant_completed"] },
          },
          select: { eventName: true },
          take: 50000,
        }),
      [] as { eventName: string }[],
    ),
    // Cost ledger last 30d (chart).
    safe(
      "costEntries",
      () =>
        prisma.costLedgerEntry.findMany({
          where: { occurredAt: { gte: since30 } },
          select: { occurredAt: true, estimatedCostUsd: true },
          take: 50000,
        }),
      [] as { occurredAt: Date; estimatedCostUsd: number }[],
    ),
    safe(
      "cost30Sum",
      () =>
        prisma.costLedgerEntry.aggregate({
          where: { occurredAt: { gte: since30 } },
          _sum: { estimatedCostUsd: true },
        }),
      { _sum: { estimatedCostUsd: 0 } } as { _sum: { estimatedCostUsd: number | null } },
    ),
    safe(
      "cost30PrevSum",
      () =>
        prisma.costLedgerEntry.aggregate({
          where: { occurredAt: { gte: since60, lt: since30 } },
          _sum: { estimatedCostUsd: true },
        }),
      { _sum: { estimatedCostUsd: 0 } } as { _sum: { estimatedCostUsd: number | null } },
    ),
    // Active Coast subscriptions (for MRR estimate).
    safe(
      "activeSubs",
      () =>
        prisma.subscription.findMany({
          where: { plan: "pro", status: { in: [...ACTIVE_SUB_STATUSES] } },
          select: { billingInterval: true },
          take: 50000,
        }),
      [] as { billingInterval: string | null }[],
    ),
    safe(
      "coastUsers",
      () => prisma.user.count({ where: { plan: "pro", isTestAccount: false } }),
      0,
    ),
    safe(
      "jobFailures7d",
      () => prisma.jobRun.count({ where: { status: "failed", createdAt: { gte: since7 } } }),
      0,
    ),
  ]);

  /* ---- Users ---- */
  const userCreated = userDates.map((u) => u.createdAt);
  const newUsers = windowCounts(userCreated, now);
  // 7d-over-prior-7d trend for the headline signups number.
  const newUsersPrev7 = userCreated.filter((d) => {
    const t = new Date(d).getTime();
    return t >= now - 14 * DAY_MS && t < now - 7 * DAY_MS;
  }).length;
  const newUsersDelta = delta(newUsers.d7, newUsersPrev7, true);

  const lastActive = activeDates
    .map((u) => u.lastActiveAt)
    .filter((d): d is Date => d != null);
  const activeUsers = windowCounts(lastActive, now);
  // "Sparse" when we have users but almost none with a lastActiveAt signal.
  const activeUsersSparse = totalUsers > 0 && lastActive.length < Math.max(1, totalUsers * 0.05);

  /* ---- Products ---- */
  const productCreated = productRows.map((p) => p.createdAt);
  const totalProducts = productRows.length;
  const newProducts = windowCounts(productCreated, now);
  const newProductsPrev7 = productCreated.filter((d) => {
    const t = new Date(d).getTime();
    return t >= now - 14 * DAY_MS && t < now - 7 * DAY_MS;
  }).length;
  const newProductsDelta = delta(newProducts.d7, newProductsPrev7, true);

  /* ---- Parser ---- */
  const parserTotal = parseAttempts.length;
  const parserHasData = parserTotal > 0;
  const parserSuccess = parseAttempts.filter((a) => a.status === "success").length;
  const parserFailed = parseAttempts.filter((a) => a.status === "failed").length;
  const parser = parserHasData
    ? {
        total: parserTotal,
        successRate: rate(parserSuccess, parserTotal),
        failureRate: rate(parserFailed, parserTotal),
        avgConfidenceLabel: avgConfidenceLabel(parseAttempts.map((a) => a.confidence)),
        isDemo: false,
      }
    : {
        // Clearly-labelled demo values when no parse attempts recorded yet.
        total: 0,
        successRate: 96.4,
        failureRate: 3.6,
        avgConfidenceLabel: "High",
        isDemo: true,
      };

  /* ---- Notifications ---- */
  const notificationsDeliveredRate = rate(notificationsRead, notificationsTotal);

  /* ---- Checkout Assistant ---- */
  const checkoutStarted = checkoutEvents.filter(
    (e) => e.eventName === "checkout_assistant_started",
  ).length;
  const checkoutCompleted = checkoutEvents.filter(
    (e) => e.eventName === "checkout_assistant_completed",
  ).length;
  const checkoutHasData = checkoutEvents.length > 0;
  const checkout = checkoutHasData
    ? { started: checkoutStarted, completed: checkoutCompleted, isDemo: false }
    : { started: 0, completed: 0, isDemo: true };

  /* ---- Costs ---- */
  const cost30 = cost30Sum._sum.estimatedCostUsd ?? 0;
  const cost30Prev = cost30PrevSum._sum.estimatedCostUsd ?? 0;
  const costHasData = costEntries.length > 0 || cost30 > 0;
  const cost = {
    last30dUsd: costHasData ? cost30 : 0,
    // Cost rising is bad, so up is not good here.
    delta: costHasData ? delta(cost30, cost30Prev, false) : null,
    isDemo: !costHasData,
  };

  /* ---- Billing (MRR estimate) ---- */
  const mrrUsd = activeSubs.reduce((sum, s) => {
    return (
      sum + (s.billingInterval === "year" ? COAST_ANNUAL_MONTHLY_USD : COAST_MONTHLY_USD)
    );
  }, 0);
  // We multiply by the published list price, not the actual Stripe-charged
  // amount, so this is an estimate/placeholder rather than reconciled revenue.
  const mrrIsPlaceholder = true;

  /* ---- System status ---- */
  const dbStatus: SystemStatus = noDatabase ? "down" : "operational";
  const systemStatus: SystemStatus = jobFailures7d > 0 ? "degraded" : dbStatus;
  const services: ServiceHealth[] = [
    {
      key: "database",
      name: "Database",
      status: dbStatus,
      detail: noDatabase ? "No DATABASE_URL configured" : "Postgres (Neon)",
    },
    {
      key: "jobs",
      name: "Background jobs",
      status: noDatabase ? "unknown" : jobFailures7d > 0 ? "degraded" : "operational",
      detail:
        jobFailures7d > 0 ? jobFailures7d + " failed in last 7 days" : "No recent failures",
    },
    {
      key: "parser",
      name: "Parser",
      status: parserHasData
        ? parser.successRate >= 90
          ? "operational"
          : parser.successRate >= 70
            ? "degraded"
            : "down"
        : "unknown",
      detail: parserHasData
        ? parser.successRate.toFixed(1) + "% success (30d)"
        : "No recent attempts",
    },
    {
      key: "email",
      name: "Email delivery",
      status: process.env.RESEND_API_KEY ? "operational" : "disabled",
      detail: process.env.RESEND_API_KEY ? "Resend configured" : "Not configured",
    },
    {
      key: "billing",
      name: "Billing (Stripe)",
      status: process.env.STRIPE_SECRET_KEY ? "operational" : "disabled",
      detail: process.env.STRIPE_SECRET_KEY ? "Stripe configured" : "Not configured",
    },
  ];

  /* ---- Charts ---- */
  const signupsChart = bucketByDay(userCreated, CHART_DAYS, now);
  const productsSavedChart = bucketByDay(productCreated, CHART_DAYS, now);
  const notificationsChart = bucketByDay(
    notificationRows.map((n) => n.createdAt),
    CHART_DAYS,
    now,
  );

  const parserChart = parserHasData
    ? bucketSuccessFailByDay(
        parseAttempts,
        (a) => a.createdAt,
        (a) => a.status === "success",
        CHART_DAYS,
        now,
      )
    : demoSeries("parser-overview", CHART_DAYS, 24, 8, now).map((p) => ({
        ...p,
        value2: Math.round(p.value * 0.05),
      }));

  const costChart = costHasData
    ? bucketSumByDay(
        costEntries,
        (e) => e.occurredAt,
        (e) => e.estimatedCostUsd,
        CHART_DAYS,
        now,
      )
    : demoSeries("cost-overview", CHART_DAYS, 6, 4, now);

  return {
    noDatabase,
    totalUsers,
    newUsers,
    newUsersDelta,
    activeUsers,
    activeUsersSparse,
    totalProducts,
    newProducts,
    newProductsDelta,
    trackedProducts,
    purchasedProducts,
    releasedProducts,
    parser,
    priceChecksScheduled,
    stockChecks,
    notificationsTotal,
    notificationsRead,
    notificationsDeliveredRate,
    cartItemsActive,
    checkout,
    cost,
    mrrUsd,
    mrrIsPlaceholder,
    coastUsers,
    jobFailures7d,
    systemStatus,
    services,
    charts: {
      signups: signupsChart,
      productsSaved: productsSavedChart,
      parser: parserChart,
      parserIsDemo: !parserHasData,
      cost: costChart,
      costIsDemo: !costHasData,
      notifications: notificationsChart,
    },
  };
}
