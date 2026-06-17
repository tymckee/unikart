/**
 * UniKart Ops — API Usage dashboard data.
 *
 * Reads first-party telemetry from APIUsageEvent (written by recordApiUsage in
 * src/lib/ops/api-usage.ts). Computes all rollups from a single capped
 * findMany of the most-recent events so the dashboard is one DB round-trip.
 *
 * Honesty: every figure here is real. The page falls back to clearly-labelled
 * demo charts (DemoBadge) only when there is no data at all.
 *
 * PRIVACY: APIUsageEvent never stores request bodies or PII (only an ipHash,
 * a truncated user-agent, and a sanitized metadata blob). We never select or
 * surface ipHash / userAgent here. userId is shown shortened (shortId), and
 * resolved to an email only on the operator-facing top-users list.
 */
import { hasDatabase, prisma } from "../../db";
import {
  bucketByDay,
  topBy,
  windowCounts,
  delta,
  rate,
  DAY_MS,
} from "../metrics";
import type { ChartPoint, MetricDelta, NamedValue } from "../types";

/** One usage event, trimmed to the non-sensitive columns the dashboard needs. */
export interface ApiUsageRow {
  id: string;
  userId: string | null;
  route: string;
  method: string;
  statusCode: number;
  durationMs: number | null;
  source: string;
  provider: string | null;
  operation: string | null;
  estimatedCostUsd: number | null;
  createdAt: string;
}

export interface ApiUsageDashboard {
  /** True when there is no real telemetry yet (page shows demo charts). */
  isDemo: boolean;
  /** How many recent events the rollups are computed from (capped). */
  sampleSize: number;
  windows: { today: number; d7: number; d30: number };
  /** Requests in the last 7d vs the prior 7d. */
  requestsDelta: MetricDelta;
  /** Error rate (status >= 400) over the sample, 0–100. */
  errorRatePct: number;
  errorRateDelta: MetricDelta;
  failedCount: number;
  /** p50 / p95 / p99 latency in ms (null when no durations recorded). */
  latency: { p50: number | null; p95: number | null; p99: number | null };
  /** Daily request volume for the trend (last 30 days). */
  dailyVolume: ChartPoint[];
  /** Requests by route (top N). */
  byRoute: NamedValue[];
  /** Errors (status >= 400) by route (top N). */
  errorsByRoute: NamedValue[];
  /** Top users by request count (name resolved to email where possible). */
  topUsers: NamedValue[];
  /** Estimated spend by provider (display is pre-formatted USD). */
  costByProvider: NamedValue[];
  /** Total estimated cost across the sample. */
  totalEstimatedCostUsd: number;
  /** Most-recent failed requests (status >= 400). */
  recentFailures: ApiUsageRow[];
}

/** Cap: roll up from at most this many of the most-recent events. */
const SAMPLE_CAP = 10_000;

function toRow(r: {
  id: string;
  userId: string | null;
  route: string;
  method: string;
  statusCode: number;
  durationMs: number | null;
  source: string;
  provider: string | null;
  operation: string | null;
  estimatedCostUsd: number | null;
  createdAt: Date;
}): ApiUsageRow {
  return {
    id: r.id,
    userId: r.userId,
    route: r.route,
    method: r.method,
    statusCode: r.statusCode,
    durationMs: r.durationMs,
    source: r.source,
    provider: r.provider,
    operation: r.operation,
    estimatedCostUsd: r.estimatedCostUsd,
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * Percentile (0–1) of a numeric array. Returns null for an empty input.
 * Uses the nearest-rank method on a sorted copy.
 */
function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil(p * sorted.length);
  const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1));
  return sorted[idx];
}

const emptyDelta: MetricDelta = { pct: 0, direction: "flat", upIsGood: true };

function emptyDashboard(isDemo: boolean): ApiUsageDashboard {
  return {
    isDemo,
    sampleSize: 0,
    windows: { today: 0, d7: 0, d30: 0 },
    requestsDelta: emptyDelta,
    errorRatePct: 0,
    errorRateDelta: { ...emptyDelta, upIsGood: false },
    failedCount: 0,
    latency: { p50: null, p95: null, p99: null },
    dailyVolume: [],
    byRoute: [],
    errorsByRoute: [],
    topUsers: [],
    costByProvider: [],
    totalEstimatedCostUsd: 0,
    recentFailures: [],
  };
}

/**
 * Build the API Usage dashboard from the most-recent capped slice of telemetry.
 * Always returns a safe value (empty + isDemo on no DB / no data / error).
 */
export async function getApiUsageDashboard(): Promise<ApiUsageDashboard> {
  if (!hasDatabase()) return emptyDashboard(true);

  let events: ApiUsageRow[];
  try {
    const rows = await prisma.aPIUsageEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: SAMPLE_CAP,
      select: {
        id: true,
        userId: true,
        route: true,
        method: true,
        statusCode: true,
        durationMs: true,
        source: true,
        provider: true,
        operation: true,
        estimatedCostUsd: true,
        createdAt: true,
        // Deliberately NOT selecting ipHash / userAgent / metadataJson (PII-adjacent).
      },
    });
    events = rows.map(toRow);
  } catch (e) {
    console.error("[ops] getApiUsageDashboard:", e);
    return emptyDashboard(true);
  }

  if (events.length === 0) return emptyDashboard(true);

  const now = Date.now();
  const dates = events.map((e) => e.createdAt);
  const windows = windowCounts(dates, now);

  // Requests last 7d vs prior 7d.
  const last7 = events.filter((e) => new Date(e.createdAt).getTime() >= now - 7 * DAY_MS).length;
  const prior7 = events.filter((e) => {
    const t = new Date(e.createdAt).getTime();
    return t < now - 7 * DAY_MS && t >= now - 14 * DAY_MS;
  }).length;
  const requestsDelta = delta(last7, prior7, true);

  // Errors (status >= 400).
  const failures = events.filter((e) => e.statusCode >= 400);
  const failedCount = failures.length;
  const errorRatePct = rate(failedCount, events.length);

  // Error-rate trend: last 7d vs prior 7d (lower is better → upIsGood false).
  const last7Fail = failures.filter((e) => new Date(e.createdAt).getTime() >= now - 7 * DAY_MS).length;
  const prior7Fail = failures.filter((e) => {
    const t = new Date(e.createdAt).getTime();
    return t < now - 7 * DAY_MS && t >= now - 14 * DAY_MS;
  }).length;
  const errorRateDelta = delta(rate(last7Fail, last7), rate(prior7Fail, prior7), false);

  // Latency percentiles from recorded durations.
  const durations = events
    .map((e) => e.durationMs)
    .filter((d): d is number => d != null && !Number.isNaN(d));
  const latency = {
    p50: percentile(durations, 0.5),
    p95: percentile(durations, 0.95),
    p99: percentile(durations, 0.99),
  };

  // Rollups.
  const byRoute = topBy(events, (e) => e.route, () => 1, 10);
  const errorsByRoute = topBy(failures, (e) => e.route, () => 1, 8);

  // Top users by request count — resolve ids to emails for the operator.
  const userCounts = topBy(
    events.filter((e) => e.userId),
    (e) => e.userId as string,
    () => 1,
    8,
  );
  const topUsers = await resolveUserNames(userCounts);

  // Estimated cost by provider (sum estimatedCostUsd, only events that carry one).
  const costByProvider = topBy(
    events.filter((e) => e.estimatedCostUsd != null && (e.provider ?? "").length > 0),
    (e) => e.provider as string,
    (e) => e.estimatedCostUsd ?? 0,
    8,
  ).map((seg) => ({ ...seg, display: usdShort(seg.value) }));
  const totalEstimatedCostUsd = events.reduce((s, e) => s + (e.estimatedCostUsd ?? 0), 0);

  // Daily request volume trend (last 30 days).
  const dailyVolume = bucketByDay(dates, 30, now);

  // Recent failures (already newest-first from the query order).
  const recentFailures = failures.slice(0, 12);

  return {
    isDemo: false,
    sampleSize: events.length,
    windows,
    requestsDelta,
    errorRatePct,
    errorRateDelta,
    failedCount,
    latency,
    dailyVolume,
    byRoute,
    errorsByRoute,
    topUsers,
    costByProvider,
    totalEstimatedCostUsd,
    recentFailures,
  };
}

/** Local compact USD for chart legends (avoids importing client format here). */
function usdShort(n: number): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n < 1 && n !== 0 ? 4 : 2,
    minimumFractionDigits: 2,
  }).format(n);
}

/**
 * Resolve a top-users rollup (keyed by userId) to display emails where known,
 * falling back to a shortened id. Best-effort — never throws.
 */
async function resolveUserNames(counts: NamedValue[]): Promise<NamedValue[]> {
  if (counts.length === 0) return counts;
  const ids = counts.map((c) => c.name);
  let emailById = new Map<string, string>();
  try {
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, email: true },
    });
    emailById = new Map(users.map((u) => [u.id, u.email]));
  } catch (e) {
    console.error("[ops] resolveUserNames:", e);
  }
  return counts.map((c) => ({
    name: emailById.get(c.name) ?? shortIdLocal(c.name),
    value: c.value,
  }));
}

/** Local id shortener (mirrors format.shortId; kept here to stay self-contained). */
function shortIdLocal(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 5)}…${id.slice(-4)}`;
}

/* ------------------------------------------------------------------ */
/* Export feed                                                         */
/* ------------------------------------------------------------------ */

/** A single CSV-ready usage event (non-sensitive columns only). */
export interface ApiUsageExportRow {
  createdAt: string;
  route: string;
  method: string;
  statusCode: number;
  durationMs: number | null;
  provider: string | null;
  operation: string | null;
  estimatedCostUsd: number | null;
}

/**
 * Fetch a capped, newest-first slice of usage events for CSV export. Never
 * selects ipHash / userAgent / metadataJson (no request bodies, no PII).
 */
export async function getApiUsageForExport(limit = SAMPLE_CAP): Promise<ApiUsageExportRow[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await prisma.aPIUsageEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(SAMPLE_CAP, Math.max(1, limit)),
      select: {
        createdAt: true,
        route: true,
        method: true,
        statusCode: true,
        durationMs: true,
        provider: true,
        operation: true,
        estimatedCostUsd: true,
      },
    });
    return rows.map((r) => ({
      createdAt: r.createdAt.toISOString(),
      route: r.route,
      method: r.method,
      statusCode: r.statusCode,
      durationMs: r.durationMs,
      provider: r.provider,
      operation: r.operation,
      estimatedCostUsd: r.estimatedCostUsd,
    }));
  } catch (e) {
    console.error("[ops] getApiUsageForExport:", e);
    return [];
  }
}
