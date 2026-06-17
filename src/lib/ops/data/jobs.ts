/**
 * UniKart Ops — Jobs data access (background job observability).
 *
 * Reads the JobRun table to power the /ops/jobs dashboard: windowed run counts,
 * failure rate, average duration, a per-day duration trend, and a server-driven
 * paginated table of recent runs. Every query guards `hasDatabase()` and is
 * wrapped in try/catch so a DB hiccup degrades to an honest empty/zero state
 * rather than throwing. No fabricated rows — when there's no data the page shows
 * a clearly-labelled demo trend (with DemoBadge) and a calm empty table.
 */
import { hasDatabase, prisma } from "@/lib/db";
import type { ListParams } from "./common";
import { windowCounts, bucketSumByDay, rate, DAY_MS } from "@/lib/ops/metrics";
import type { ChartPoint } from "@/lib/ops/types";

/** Allowed job types (mirrors JobType in src/lib/ops/jobs.ts). */
export const JOB_TYPES = [
  "price_check",
  "stock_check",
  "parser",
  "notification",
  "cleanup",
  "billing_sync",
  "email",
] as const;

/** Allowed run statuses. */
export const JOB_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "canceled",
] as const;

/** One job-run row as the table renders it. */
export interface JobRunView {
  id: string;
  jobType: string;
  status: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  errorCode: string | null;
  errorMessage: string | null;
  metadataJson: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface JobStats {
  runs24h: number;
  runs7d: number;
  failed24h: number;
  failureRate7d: number;
  avgDurationMs7d: number | null;
  durationTrend: ChartPoint[];
  /** True when there's no real JobRun data and the trend is a demo fallback. */
  isDemo: boolean;
}

const SORTABLE: Record<string, string> = {
  createdAt: "createdAt",
  startedAt: "startedAt",
  durationMs: "durationMs",
  itemsProcessed: "itemsProcessed",
  itemsFailed: "itemsFailed",
};

function toView(r: {
  id: string;
  jobType: string;
  status: string;
  startedAt: Date | null;
  finishedAt: Date | null;
  durationMs: number | null;
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  errorCode: string | null;
  errorMessage: string | null;
  metadataJson: string | null;
  createdBy: string | null;
  createdAt: Date;
}): JobRunView {
  return {
    id: r.id,
    jobType: r.jobType,
    status: r.status,
    startedAt: r.startedAt ? r.startedAt.toISOString() : null,
    finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
    durationMs: r.durationMs,
    itemsProcessed: r.itemsProcessed,
    itemsSucceeded: r.itemsSucceeded,
    itemsFailed: r.itemsFailed,
    errorCode: r.errorCode,
    errorMessage: r.errorMessage,
    metadataJson: r.metadataJson,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * Server-driven list of recent job runs. Reads `q` (matches jobType/errorCode/
 * errorMessage), and the `jobType` / `status` filters, then applies sort + page.
 */
export async function getJobs(
  lp: ListParams,
): Promise<{ rows: JobRunView[]; total: number }> {
  if (!hasDatabase()) return { rows: [], total: 0 };
  try {
    const jobType = lp.params.jobType;
    const status = lp.params.status;

    const where: Record<string, unknown> = {};
    if (jobType && (JOB_TYPES as readonly string[]).includes(jobType)) {
      where.jobType = jobType;
    }
    if (status && (JOB_STATUSES as readonly string[]).includes(status)) {
      where.status = status;
    }
    if (lp.q) {
      where.OR = [
        { jobType: { contains: lp.q, mode: "insensitive" } },
        { errorCode: { contains: lp.q, mode: "insensitive" } },
        { errorMessage: { contains: lp.q, mode: "insensitive" } },
      ];
    }

    const sortKey = lp.sort ? SORTABLE[lp.sort.key] : undefined;
    const orderBy = sortKey
      ? { [sortKey]: lp.sort!.dir }
      : { createdAt: "desc" as const };

    const [rows, total] = await Promise.all([
      prisma.jobRun.findMany({
        where,
        orderBy,
        skip: (lp.page - 1) * lp.pageSize,
        take: lp.pageSize,
        select: {
          id: true,
          jobType: true,
          status: true,
          startedAt: true,
          finishedAt: true,
          durationMs: true,
          itemsProcessed: true,
          itemsSucceeded: true,
          itemsFailed: true,
          errorCode: true,
          errorMessage: true,
          metadataJson: true,
          createdBy: true,
          createdAt: true,
        },
      }),
      prisma.jobRun.count({ where }),
    ]);

    return { rows: rows.map(toView), total };
  } catch (e) {
    console.error("[ops] getJobs failed:", e);
    return { rows: [], total: 0 };
  }
}

/**
 * Headline stats for the metric cards + duration trend. Pulls the last 30 days
 * of runs once and aggregates in memory (cheap; the table is paginated
 * separately). Falls back to a clearly-labelled demo trend when empty.
 */
export async function getJobStats(): Promise<JobStats> {
  const empty: JobStats = {
    runs24h: 0,
    runs7d: 0,
    failed24h: 0,
    failureRate7d: 0,
    avgDurationMs7d: null,
    durationTrend: [],
    isDemo: true,
  };
  if (!hasDatabase()) return empty;
  try {
    const since = new Date(Date.now() - 30 * DAY_MS);
    const recent = await prisma.jobRun.findMany({
      where: { createdAt: { gte: since } },
      select: {
        status: true,
        durationMs: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (recent.length === 0) return empty;

    const now = Date.now();
    const wc = windowCounts(recent.map((r) => r.createdAt), now);

    // 24h window
    const cutoff24h = now - DAY_MS;
    const last24h = recent.filter((r) => r.createdAt.getTime() >= cutoff24h);
    const failed24h = last24h.filter((r) => r.status === "failed").length;

    // 7d failure rate (failed vs. terminal runs — succeeded + failed)
    const cutoff7d = now - 7 * DAY_MS;
    const last7d = recent.filter((r) => r.createdAt.getTime() >= cutoff7d);
    const terminal7d = last7d.filter(
      (r) => r.status === "succeeded" || r.status === "failed",
    );
    const failed7d = last7d.filter((r) => r.status === "failed").length;
    const failureRate7d = rate(failed7d, terminal7d.length);

    // 7d average duration (only runs that recorded a duration)
    const durations7d = last7d
      .map((r) => r.durationMs)
      .filter((d): d is number => d != null && d >= 0);
    const avgDurationMs7d =
      durations7d.length > 0
        ? Math.round(durations7d.reduce((a, b) => a + b, 0) / durations7d.length)
        : null;

    // Per-day average duration over the last 14 days for the trend Sparkline.
    const withDuration = recent.filter(
      (r): r is typeof r & { durationMs: number } =>
        r.durationMs != null && r.durationMs >= 0,
    );
    const sumByDay = bucketSumByDay(
      withDuration,
      (r) => r.createdAt,
      (r) => r.durationMs,
      14,
      now,
    );
    const countByDay = bucketSumByDay(
      withDuration,
      (r) => r.createdAt,
      () => 1,
      14,
      now,
    );
    const durationTrend: ChartPoint[] = sumByDay.map((pt, i) => {
      const count = countByDay[i]?.value ?? 0;
      return {
        label: pt.label,
        value: count > 0 ? Math.round(pt.value / count) : 0,
      };
    });

    return {
      runs24h: last24h.length,
      runs7d: wc.d7,
      failed24h,
      failureRate7d,
      avgDurationMs7d,
      durationTrend,
      isDemo: false,
    };
  } catch (e) {
    console.error("[ops] getJobStats failed:", e);
    return empty;
  }
}
