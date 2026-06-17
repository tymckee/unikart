/**
 * UniKart Ops — Parser dashboard data access.
 *
 * UniKart lives or dies by URL parsing, so this is the section that tells us how
 * the parser is actually doing: success/failure rate, confidence, which domains
 * are healthy, which need adapters, the most common failure reasons, and which
 * extraction source (JSON-LD / OG / Twitter / ecommerce meta / HTML / manual)
 * produced each result.
 *
 * Everything here is computed in JS from a single capped `findMany` of recent
 * ParseAttempt rows (the table is indexed on createdAt). No fabricated data —
 * when the table is empty, the dashboard renders an honest empty/demo state and
 * the page decides whether to show clearly-labelled demo charts.
 */
import { hasDatabase, prisma } from "../../db";
import type { ChartPoint, NamedValue } from "../types";
import { bucketSuccessFailByDay, rate, topBy } from "../metrics";

/** Recent ParseAttempt rows are capped so the rollups stay fast and bounded. */
const SCAN_LIMIT = 5000;

/** The "watchlisted domains" manual list lives in this SystemSetting key. */
export const WATCHLIST_SETTING_KEY = "parser.watchlistedDomains";

/** Maps confidence buckets to a 0–1 score for an average-confidence rollup. */
const CONFIDENCE_SCORE: Record<string, number> = { high: 1, medium: 0.6, low: 0.3 };

/** The known extraction sources, in display order. */
export const EXTRACTION_METHODS = [
  "jsonld",
  "opengraph",
  "twitter",
  "ecommerce_meta",
  "html_fallback",
  "manual_fallback",
] as const;

const EXTRACTION_LABELS: Record<string, string> = {
  jsonld: "JSON-LD",
  opengraph: "Open Graph",
  twitter: "Twitter card",
  ecommerce_meta: "Ecommerce meta",
  html_fallback: "HTML fallback",
  manual_fallback: "Manual fallback",
  unknown: "Unknown",
};

export function extractionLabel(method: string | null | undefined): string {
  if (!method) return EXTRACTION_LABELS.unknown;
  return EXTRACTION_LABELS[method] ?? method;
}

/** One recent parse attempt, shaped for the table (no raw page / no secrets). */
export interface ParseAttemptRow {
  id: string;
  createdAt: string;
  domain: string;
  status: string;
  confidence: string | null;
  extractionMethod: string | null;
  durationMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  url: string;
}

/** Per-domain rollup used by the health tables. */
export interface DomainHealth {
  domain: string;
  total: number;
  success: number;
  failed: number;
  /** Success rate as a 0–100 percentage. */
  successRate: number;
  /** Average confidence as a 0–1 score (null when no confidence recorded). */
  avgConfidence: number | null;
  /** Average duration in ms (null when no durations recorded). */
  avgDurationMs: number | null;
}

export interface ParserDashboard {
  /** True when there are no real ParseAttempt rows yet. */
  isEmpty: boolean;
  totals: {
    total: number;
    success: number;
    partial: number;
    failed: number;
    successRate: number;
    failureRate: number;
    /** Average confidence as a 0–1 score across attempts that recorded one. */
    avgConfidence: number | null;
  };
  /** Confidence distribution (high / medium / low / none). */
  confidenceDist: NamedValue[];
  /** Success vs failure per day for the trend chart. */
  trend: ChartPoint[];
  /** Extraction-source distribution for the Donut. */
  extractionDist: NamedValue[];
  /** Top domains by success rate (healthiest). */
  topDomains: DomainHealth[];
  /** Domains with the most failures. */
  failingDomains: DomainHealth[];
  /** Domains likely needing an adapter: low success rate with real volume. */
  needsAdapter: DomainHealth[];
  /** Slowest domains by average parse duration. */
  slowDomains: DomainHealth[];
  /** Most common failure reasons (errorCode, falling back to errorMessage). */
  failureReasons: NamedValue[];
  /** Most recent attempts for the table. */
  recent: ParseAttemptRow[];
}

const emptyDashboard: ParserDashboard = {
  isEmpty: true,
  totals: {
    total: 0,
    success: 0,
    partial: 0,
    failed: 0,
    successRate: 0,
    failureRate: 0,
    avgConfidence: null,
  },
  confidenceDist: [],
  trend: [],
  extractionDist: [],
  topDomains: [],
  failingDomains: [],
  needsAdapter: [],
  slowDomains: [],
  failureReasons: [],
  recent: [],
};

type RawAttempt = {
  id: string;
  createdAt: Date;
  domain: string;
  status: string;
  confidence: string | null;
  extractionMethod: string | null;
  durationMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  url: string;
};

function isSuccess(status: string): boolean {
  return status === "success";
}

/** Build per-domain rollups from the scanned attempts. */
function rollupByDomain(attempts: RawAttempt[]): DomainHealth[] {
  const map = new Map<
    string,
    { total: number; success: number; failed: number; confSum: number; confN: number; durSum: number; durN: number }
  >();
  for (const a of attempts) {
    const key = a.domain || "—";
    let agg = map.get(key);
    if (!agg) {
      agg = { total: 0, success: 0, failed: 0, confSum: 0, confN: 0, durSum: 0, durN: 0 };
      map.set(key, agg);
    }
    agg.total++;
    if (isSuccess(a.status)) agg.success++;
    if (a.status === "failed") agg.failed++;
    const score = a.confidence ? CONFIDENCE_SCORE[a.confidence] : undefined;
    if (score != null) {
      agg.confSum += score;
      agg.confN++;
    }
    if (a.durationMs != null) {
      agg.durSum += a.durationMs;
      agg.durN++;
    }
  }
  return [...map.entries()].map(([domain, agg]) => ({
    domain,
    total: agg.total,
    success: agg.success,
    failed: agg.failed,
    successRate: rate(agg.success, agg.total),
    avgConfidence: agg.confN > 0 ? Math.round((agg.confSum / agg.confN) * 100) / 100 : null,
    avgDurationMs: agg.durN > 0 ? Math.round(agg.durSum / agg.durN) : null,
  }));
}

/**
 * The whole Parser dashboard, computed from one capped scan of recent attempts.
 * Always returns a safe empty dashboard on no-DB / error (never throws).
 */
export async function getParserDashboard(): Promise<ParserDashboard> {
  if (!hasDatabase()) return emptyDashboard;
  try {
    const attempts = (await prisma.parseAttempt.findMany({
      orderBy: { createdAt: "desc" },
      take: SCAN_LIMIT,
      select: {
        id: true,
        createdAt: true,
        domain: true,
        status: true,
        confidence: true,
        extractionMethod: true,
        durationMs: true,
        errorCode: true,
        errorMessage: true,
        url: true,
      },
    })) as RawAttempt[];

    if (attempts.length === 0) return emptyDashboard;

    const total = attempts.length;
    const success = attempts.filter((a) => isSuccess(a.status)).length;
    const partial = attempts.filter((a) => a.status === "partial").length;
    const failed = attempts.filter((a) => a.status === "failed").length;

    // Average confidence across attempts that recorded one.
    let confSum = 0;
    let confN = 0;
    const confCounts: Record<string, number> = { high: 0, medium: 0, low: 0, none: 0 };
    for (const a of attempts) {
      const score = a.confidence ? CONFIDENCE_SCORE[a.confidence] : undefined;
      if (score != null) {
        confSum += score;
        confN++;
        confCounts[a.confidence as string] = (confCounts[a.confidence as string] ?? 0) + 1;
      } else {
        confCounts.none++;
      }
    }
    const avgConfidence = confN > 0 ? Math.round((confSum / confN) * 100) / 100 : null;

    const confidenceDist: NamedValue[] = [
      { name: "High", value: confCounts.high },
      { name: "Medium", value: confCounts.medium },
      { name: "Low", value: confCounts.low },
      { name: "None", value: confCounts.none },
    ].filter((d) => d.value > 0);

    // Success vs failure per day (oldest → newest) for the trend chart.
    const trend = bucketSuccessFailByDay(
      attempts,
      (a) => a.createdAt,
      (a) => isSuccess(a.status),
      30,
    );

    // Extraction-source distribution.
    const extractionDist = topBy(
      attempts,
      (a) => extractionLabel(a.extractionMethod),
      () => 1,
      EXTRACTION_METHODS.length + 1,
    );

    // Most common failure reasons (errorCode first, then errorMessage).
    const failures = attempts.filter((a) => a.status === "failed");
    const failureReasons = topBy(
      failures,
      (a) => a.errorCode || a.errorMessage || "Unknown reason",
      () => 1,
      8,
    );

    // Per-domain rollups.
    const domains = rollupByDomain(attempts);

    // Domains with enough volume to judge (avoids noisy one-off domains).
    const withVolume = domains.filter((d) => d.total >= 3);

    const topDomains = [...domains]
      .sort((a, b) => b.successRate - a.successRate || b.total - a.total)
      .slice(0, 8);

    const failingDomains = [...domains]
      .filter((d) => d.failed > 0)
      .sort((a, b) => b.failed - a.failed || a.successRate - b.successRate)
      .slice(0, 8);

    const needsAdapter = [...withVolume]
      .filter((d) => d.successRate < 70)
      .sort((a, b) => a.successRate - b.successRate || b.total - a.total)
      .slice(0, 8);

    const slowDomains = [...domains]
      .filter((d) => d.avgDurationMs != null)
      .sort((a, b) => (b.avgDurationMs ?? 0) - (a.avgDurationMs ?? 0))
      .slice(0, 8);

    const recent: ParseAttemptRow[] = attempts.slice(0, 50).map((a) => ({
      id: a.id,
      createdAt: a.createdAt.toISOString(),
      domain: a.domain,
      status: a.status,
      confidence: a.confidence,
      extractionMethod: a.extractionMethod,
      durationMs: a.durationMs,
      errorCode: a.errorCode,
      errorMessage: a.errorMessage,
      url: a.url,
    }));

    return {
      isEmpty: false,
      totals: {
        total,
        success,
        partial,
        failed,
        successRate: rate(success, total),
        failureRate: rate(failed, total),
        avgConfidence,
      },
      confidenceDist,
      trend,
      extractionDist,
      topDomains,
      failingDomains,
      needsAdapter,
      slowDomains,
      failureReasons,
      recent,
    };
  } catch (e) {
    console.error("[ops] getParserDashboard:", e);
    return emptyDashboard;
  }
}

/**
 * The manual watchlist of domains flagged for review, plus any per-domain notes
 * (SystemSetting "parser.note.<domain>"). Returned as a Set for cheap lookups.
 */
export interface WatchlistData {
  domains: string[];
  notes: Record<string, string>;
}

export async function getWatchlistedDomains(): Promise<WatchlistData> {
  const empty: WatchlistData = { domains: [], notes: {} };
  if (!hasDatabase()) return empty;
  try {
    const [watchSetting, noteSettings] = await Promise.all([
      prisma.systemSetting.findUnique({
        where: { key: WATCHLIST_SETTING_KEY },
        select: { valueJson: true },
      }),
      prisma.systemSetting.findMany({
        where: { key: { startsWith: "parser.note." } },
        select: { key: true, valueJson: true },
      }),
    ]);

    let domains: string[] = [];
    if (watchSetting?.valueJson) {
      try {
        const parsed = JSON.parse(watchSetting.valueJson);
        if (Array.isArray(parsed)) {
          domains = parsed.filter((d): d is string => typeof d === "string");
        }
      } catch {
        domains = [];
      }
    }

    const notes: Record<string, string> = {};
    for (const s of noteSettings) {
      const domain = s.key.slice("parser.note.".length);
      try {
        const value = JSON.parse(s.valueJson);
        if (typeof value === "string" && value.trim()) notes[domain] = value;
      } catch {
        // ignore malformed note
      }
    }

    return { domains: domains.sort(), notes };
  } catch (e) {
    console.error("[ops] getWatchlistedDomains:", e);
    return empty;
  }
}
