/**
 * UniKart Ops — Billing read access (read-only, Stripe TEST mode).
 *
 * The only thing UniKart bills for is the UniKart Coast subscription. This layer
 * reads ONLY from the local Subscription table and User.plan — it never calls
 * Stripe, never reads card data (there is none in this schema), and never
 * surfaces a secret. Every figure that can't be derived from real rows is shown
 * as a calm "no data yet" state rather than a fabricated number.
 *
 * MRR here is an *estimate* derived from a fixed price assumption (monthly $5,
 * yearly $49 → $49/12 per month) over active/trialing subscriptions; the page
 * labels it as an estimate. Churn is a 30-day "canceled" count surfaced as a
 * placeholder (we don't yet retain enough history for a true churn rate).
 *
 * All reads guard hasDatabase() and try/catch, returning a safe fallback.
 */
import { hasDatabase, prisma } from "../../db";
import type { ListParams } from "./common";
import { DAY_MS } from "../metrics";
import type { NamedValue } from "../types";

/* ---- Pricing assumptions (UniKart Coast) ---------------------------------- */

/**
 * Price assumptions used for the MRR estimate. These mirror the public pricing
 * ($5/month, $49/year) — they are assumptions for an internal estimate, not a
 * read of the live Stripe price. If Stripe prices change, update these.
 */
export const COAST_MONTHLY_USD = 5;
export const COAST_ANNUAL_USD = 49;

/** Internal DB plan key for the paid tier (UI copy is always "UniKart Coast"). */
export const PAID_PLAN_KEY = "pro";

/** Statuses we treat as currently earning (for the MRR estimate). */
const EARNING_STATUSES = new Set(["active", "trialing"]);

/** Human label for a plan key. Internal key "pro" → "UniKart Coast". */
export function planLabel(plan: string | null | undefined): string {
  if (plan === PAID_PLAN_KEY) return "UniKart Coast";
  if (plan === "free" || plan == null || plan === "") return "Free";
  // Unknown plan key — show it plainly rather than guessing.
  return plan;
}

/** Monthly USD contribution of one subscription, by interval. */
function monthlyValue(billingInterval: string | null | undefined): number {
  if (billingInterval === "year") return COAST_ANNUAL_USD / 12;
  // Default (and explicit "month") to the monthly price.
  return COAST_MONTHLY_USD;
}

/* ---- List: customers / subscriptions ------------------------------------- */

export interface BillingRow {
  /** Subscription id (row key). */
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  /** DB plan key on the subscription ("pro" → "UniKart Coast" in UI). */
  plan: string;
  status: string;
  billingInterval: string | null;
  periodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdReference: string | null;
}

export interface BillingListResult {
  rows: BillingRow[];
  total: number;
}

const SORTABLE: Record<string, string> = {
  periodEnd: "periodEnd",
  trialEnd: "trialEnd",
  status: "status",
};

/**
 * Filtered, sorted, paginated subscriptions joined to their user. Search spans
 * the user's email/name and the subscription/customer ids. Filters: status,
 * interval. Never selects any token or secret column.
 */
export async function getBillingSubscriptions(
  lp: ListParams,
): Promise<BillingListResult> {
  const empty: BillingListResult = { rows: [], total: 0 };
  if (!hasDatabase()) return empty;

  const where: Record<string, unknown> = {};

  if (lp.q) {
    where.OR = [
      { user: { email: { contains: lp.q, mode: "insensitive" } } },
      { user: { name: { contains: lp.q, mode: "insensitive" } } },
      { id: { equals: lp.q } },
      { referenceId: { equals: lp.q } },
      { stripeCustomerId: { equals: lp.q } },
    ];
  }

  const status = lp.params.status;
  if (status) where.status = status;

  const interval = lp.params.interval;
  if (interval) where.billingInterval = interval;

  // periodEnd / trialEnd can be null; keep nulls last for a calm default order.
  const dir = lp.sort?.dir === "asc" ? "asc" : "desc";
  const sortKey = lp.sort?.key && SORTABLE[lp.sort.key] ? lp.sort.key : "periodEnd";
  const orderBy = { [SORTABLE[sortKey]]: dir };

  try {
    const [subs, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        orderBy,
        skip: (lp.page - 1) * lp.pageSize,
        take: lp.pageSize,
        select: {
          id: true,
          referenceId: true,
          plan: true,
          status: true,
          billingInterval: true,
          periodEnd: true,
          trialEnd: true,
          cancelAtPeriodEnd: true,
          user: { select: { email: true, name: true, plan: true } },
        },
      }),
      prisma.subscription.count({ where }),
    ]);

    const rows: BillingRow[] = subs.map((s) => ({
      id: s.id,
      userId: s.referenceId,
      userEmail: s.user?.email ?? "—",
      userName: s.user?.name ?? "—",
      // Prefer the subscription's plan; fall back to the user's plan key.
      plan: s.plan || s.user?.plan || "free",
      status: s.status,
      billingInterval: s.billingInterval ?? null,
      periodEnd: s.periodEnd ? s.periodEnd.toISOString() : null,
      trialEnd: s.trialEnd ? s.trialEnd.toISOString() : null,
      cancelAtPeriodEnd: Boolean(s.cancelAtPeriodEnd),
      createdReference: s.referenceId ?? null,
    }));

    return { rows, total };
  } catch (e) {
    console.error("[ops] getBillingSubscriptions failed:", e);
    return empty;
  }
}

/* ---- Overview ------------------------------------------------------------- */

export interface StripeReadiness {
  key: string;
  label: string;
  /** True when we can confirm presence from env (never the value itself). */
  ready: boolean;
  detail: string;
}

export interface BillingOverview {
  /** True when there are no subscription rows yet — the page labels figures. */
  isDemo: boolean;
  /** Always true here: this environment runs Stripe in test mode. */
  testMode: boolean;
  /** Plan distribution across all users (Free vs UniKart Coast). */
  planMix: { free: number; coast: number; total: number };
  planSegments: NamedValue[];
  /** Subscription status counts (active / trialing / past_due / canceled / other). */
  statusCounts: {
    active: number;
    trialing: number;
    pastDue: number;
    canceled: number;
    other: number;
    total: number;
  };
  /** Monthly recurring revenue ESTIMATE (USD) over active + trialing subs. */
  mrrEstimateUsd: number;
  /** Count of subscriptions included in the MRR estimate. */
  earningSubs: number;
  /** Annual run-rate estimate (MRR × 12). */
  arrEstimateUsd: number;
  /** Placeholder churn signal: subscriptions canceled in the last 30 days. */
  canceledLast30d: number;
  /** Subscriptions in a past_due state (failed/overdue payment). */
  pastDueCount: number;
  /** Stripe go-live readiness checklist (informational, derived from env). */
  readiness: StripeReadiness[];
}

const EMPTY_OVERVIEW: BillingOverview = {
  isDemo: true,
  testMode: true,
  planMix: { free: 0, coast: 0, total: 0 },
  planSegments: [],
  statusCounts: { active: 0, trialing: 0, pastDue: 0, canceled: 0, other: 0, total: 0 },
  mrrEstimateUsd: 0,
  earningSubs: 0,
  arrEstimateUsd: 0,
  canceledLast30d: 0,
  pastDueCount: 0,
  readiness: [],
};

/**
 * Stripe go-live readiness. Each item is derived from non-secret env presence
 * where possible (Boolean(process.env.X)) — we never read or render the value.
 * Items we can't verify from the server are framed as a manual confirmation.
 */
function buildReadiness(): StripeReadiness[] {
  const hasSecret = Boolean(process.env.STRIPE_SECRET_KEY);
  const hasWebhook = Boolean(process.env.STRIPE_WEBHOOK_SECRET);
  const hasMonthlyPrice = Boolean(process.env.STRIPE_PRO_PRICE_ID);
  const hasAnnualPrice = Boolean(process.env.STRIPE_PRO_ANNUAL_PRICE_ID);

  return [
    {
      key: "secret_key",
      label: "Stripe secret key configured",
      ready: hasSecret,
      detail: hasSecret
        ? "A Stripe secret key is present (currently a test-mode key)."
        : "No Stripe secret key is configured.",
    },
    {
      key: "webhook",
      label: "Webhook secret configured",
      ready: hasWebhook,
      detail: hasWebhook
        ? "A webhook signing secret is present; needs a live-mode endpoint before launch."
        : "No webhook signing secret is configured.",
    },
    {
      key: "monthly_price",
      label: "Monthly price configured",
      ready: hasMonthlyPrice,
      detail: hasMonthlyPrice
        ? "A monthly price id is set; confirm it points at a live-mode price before launch."
        : "No monthly price id is configured.",
    },
    {
      key: "annual_price",
      label: "Annual price configured",
      ready: hasAnnualPrice,
      detail: hasAnnualPrice
        ? "An annual price id is set; confirm it points at a live-mode price before launch."
        : "No annual price id is configured (annual billing is optional).",
    },
    {
      key: "live_keys",
      label: "Live keys held in production",
      // Can't verify a key's mode from presence alone; this is a manual gate.
      ready: false,
      detail: "Manual check: rotate test keys to live keys in the production environment.",
    },
    {
      key: "account_activated",
      label: "Stripe account activated",
      ready: false,
      detail: "Manual check: complete Stripe account activation (business details, payouts).",
    },
  ];
}

/**
 * Everything the Billing page needs in one read. Counts plan distribution across
 * users, tallies subscription statuses, and derives an MRR estimate over the
 * active/trialing subscriptions. Card data is never read.
 */
export async function getBillingOverview(now = Date.now()): Promise<BillingOverview> {
  const readiness = buildReadiness();
  if (!hasDatabase()) return { ...EMPTY_OVERVIEW, readiness };

  try {
    const since30 = new Date(now - 30 * DAY_MS);

    const [coastUsers, totalUsers, subs, canceledLast30d] = await Promise.all([
      prisma.user.count({ where: { plan: PAID_PLAN_KEY } }).catch(() => 0),
      prisma.user.count().catch(() => 0),
      prisma.subscription
        .findMany({
          select: { status: true, billingInterval: true },
        })
        .catch(() => [] as { status: string; billingInterval: string | null }[]),
      // Placeholder churn signal: cancellations recorded in the last 30 days.
      prisma.subscription
        .count({ where: { status: "canceled", canceledAt: { gte: since30 } } })
        .catch(() => 0),
    ]);

    const freeUsers = Math.max(0, totalUsers - coastUsers);

    // Tally subscription statuses + build the MRR estimate in one pass.
    let active = 0;
    let trialing = 0;
    let pastDue = 0;
    let canceled = 0;
    let other = 0;
    let mrr = 0;
    let earningSubs = 0;
    for (const s of subs) {
      switch (s.status) {
        case "active":
          active++;
          break;
        case "trialing":
          trialing++;
          break;
        case "past_due":
          pastDue++;
          break;
        case "canceled":
        case "cancelled":
          canceled++;
          break;
        default:
          other++;
      }
      if (EARNING_STATUSES.has(s.status)) {
        mrr += monthlyValue(s.billingInterval);
        earningSubs++;
      }
    }

    const mrrEstimateUsd = Math.round(mrr * 100) / 100;
    const isDemo = subs.length === 0 && totalUsers === 0;

    const planSegments: NamedValue[] = [
      { name: "Free", value: freeUsers },
      { name: "UniKart Coast", value: coastUsers },
    ];

    return {
      isDemo,
      testMode: true,
      planMix: { free: freeUsers, coast: coastUsers, total: totalUsers },
      planSegments,
      statusCounts: {
        active,
        trialing,
        pastDue,
        canceled,
        other,
        total: subs.length,
      },
      mrrEstimateUsd,
      earningSubs,
      arrEstimateUsd: Math.round(mrrEstimateUsd * 12 * 100) / 100,
      canceledLast30d,
      pastDueCount: pastDue,
      readiness,
    };
  } catch (e) {
    console.error("[ops] getBillingOverview failed:", e);
    return { ...EMPTY_OVERVIEW, readiness };
  }
}
