/**
 * UniKart Ops — System health data access.
 *
 * getSystemHealth() assembles a calm, honest read on every service that keeps
 * UniKart running, plus a few operational details (deploy hash, environment,
 * recent failed jobs, slowest API calls). Each probe is independently guarded
 * (hasDatabase + try/catch) so a single failure degrades to an honest
 * "unknown" rather than throwing or blanking the page.
 *
 * Honesty: nothing here is fabricated. Where a signal genuinely doesn't exist
 * yet (uptime, captured errors, image storage) we return null / an empty list
 * and the page says so plainly — no demo numbers stand in for real telemetry.
 *
 * Server-only (imports prisma). Consumed by the /ops/system server page.
 *
 * PRIVACY: never selects or surfaces secrets, tokens, ipHash, or userAgent.
 * Environment checks read only the *presence* of a key (Boolean(...)), never
 * its value.
 */
import { hasDatabase, prisma } from "../../db";
import { rate, DAY_MS } from "../metrics";
import type { ServiceHealth, SystemStatus } from "../types";

/** A recently-failed background job, trimmed for the System page. */
export interface FailedJobView {
  id: string;
  jobType: string;
  errorCode: string | null;
  errorMessage: string | null;
  finishedAt: string | null;
  createdAt: string;
}

/** A slow API call (no PII — route + duration + status only). */
export interface SlowApiCallView {
  id: string;
  route: string;
  method: string;
  statusCode: number;
  durationMs: number;
  createdAt: string;
}

export interface SystemHealth {
  /** True only when there is no database configured at all. */
  noDatabase: boolean;
  /** Each service as a spoke on the wheel. */
  services: ServiceHealth[];
  /** Worst current status across services — drives the headline tone. */
  worstStatus: SystemStatus;
  /** Database ping latency in ms (null when unreachable / no DB). */
  dbLatencyMs: number | null;

  /* Deploy / runtime */
  commitHash: string | null;
  environment: string;
  /** Honest placeholder — we don't track process uptime in this build. */
  uptime: string | null;

  /* Errors — honest: we don't have an error-capture pipeline wired yet. */
  recentErrors: string | null;

  /* Operational tails */
  recentFailedJobs: FailedJobView[];
  slowApiCalls: SlowApiCallView[];
}

/** Worst-first ordering so the headline reflects the most degraded service. */
const STATUS_RANK: Record<SystemStatus, number> = {
  down: 0,
  degraded: 1,
  unknown: 2,
  disabled: 3,
  operational: 4,
};

function worstOf(services: ServiceHealth[]): SystemStatus {
  return services.reduce<SystemStatus>(
    (acc, s) => (STATUS_RANK[s.status] < STATUS_RANK[acc] ? s.status : acc),
    "operational",
  );
}

/** Ping the database with a trivial query; report reachability + latency. */
async function pingDatabase(): Promise<{ ok: boolean; latencyMs: number | null }> {
  if (!hasDatabase()) return { ok: false, latencyMs: null };
  const start = Date.now();
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2500)),
    ]);
    return { ok: true, latencyMs: Date.now() - start };
  } catch (e) {
    console.error("[ops] pingDatabase:", e);
    return { ok: false, latencyMs: Date.now() - start };
  }
}

/**
 * Parser health from recent ParseAttempt success rate (last 7 days).
 * operational ≥ 90% · degraded ≥ 70% · down below that · unknown when no data.
 */
async function parserHealth(): Promise<ServiceHealth> {
  const base = { key: "parser", name: "Parser" };
  if (!hasDatabase()) return { ...base, status: "unknown", detail: "No database" };
  try {
    const since = new Date(Date.now() - 7 * DAY_MS);
    const recent = await prisma.parseAttempt.findMany({
      where: { createdAt: { gte: since } },
      select: { status: true },
    });
    if (recent.length === 0) {
      return { ...base, status: "unknown", detail: "No recent attempts" };
    }
    const success = recent.filter((a) => a.status === "success").length;
    const successRate = rate(success, recent.length);
    const status: SystemStatus =
      successRate >= 90 ? "operational" : successRate >= 70 ? "degraded" : "down";
    return {
      ...base,
      status,
      detail: successRate.toFixed(1) + "% success (7d, " + recent.length + " attempts)",
    };
  } catch (e) {
    console.error("[ops] parserHealth:", e);
    return { ...base, status: "unknown", detail: "Could not read attempts" };
  }
}

/**
 * Background-jobs health from recent JobRun rows (last 7 days).
 * degraded when there are recent failures, operational when there are runs and
 * none failed, unknown when there's nothing to judge by.
 */
async function jobsHealth(): Promise<ServiceHealth> {
  const base = { key: "jobs", name: "Background jobs" };
  if (!hasDatabase()) return { ...base, status: "unknown", detail: "No database" };
  try {
    const since = new Date(Date.now() - 7 * DAY_MS);
    const [total, failed] = await Promise.all([
      prisma.jobRun.count({ where: { createdAt: { gte: since } } }),
      prisma.jobRun.count({ where: { createdAt: { gte: since }, status: "failed" } }),
    ]);
    if (total === 0) return { ...base, status: "unknown", detail: "No recent runs" };
    if (failed > 0) {
      return { ...base, status: "degraded", detail: failed + " failed in last 7 days" };
    }
    return { ...base, status: "operational", detail: "No recent failures" };
  } catch (e) {
    console.error("[ops] jobsHealth:", e);
    return { ...base, status: "unknown", detail: "Could not read runs" };
  }
}

/** Most-recent failed jobs (last 5) — newest first. Never throws. */
async function getRecentFailedJobs(): Promise<FailedJobView[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await prisma.jobRun.findMany({
      where: { status: "failed" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        jobType: true,
        errorCode: true,
        errorMessage: true,
        finishedAt: true,
        createdAt: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      jobType: r.jobType,
      errorCode: r.errorCode,
      errorMessage: r.errorMessage,
      finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (e) {
    console.error("[ops] getRecentFailedJobs:", e);
    return [];
  }
}

/**
 * Slowest recent API calls (top 5 by recorded duration). Non-sensitive columns
 * only — never selects ipHash / userAgent / request bodies. We look at the last
 * 7 days so "slow" reflects current behaviour, not an old outlier.
 */
async function getSlowApiCalls(): Promise<SlowApiCallView[]> {
  if (!hasDatabase()) return [];
  try {
    const since = new Date(Date.now() - 7 * DAY_MS);
    const rows = await prisma.aPIUsageEvent.findMany({
      where: { createdAt: { gte: since }, durationMs: { not: null } },
      orderBy: { durationMs: "desc" },
      take: 5,
      select: {
        id: true,
        route: true,
        method: true,
        statusCode: true,
        durationMs: true,
        createdAt: true,
      },
    });
    return rows
      .filter((r): r is typeof r & { durationMs: number } => r.durationMs != null)
      .map((r) => ({
        id: r.id,
        route: r.route,
        method: r.method,
        statusCode: r.statusCode,
        durationMs: r.durationMs,
        createdAt: r.createdAt.toISOString(),
      }));
  } catch (e) {
    console.error("[ops] getSlowApiCalls:", e);
    return [];
  }
}

/**
 * Assemble the full system-health view in one parallel pass. Always returns a
 * safe value — every probe degrades to "unknown"/empty on error rather than
 * throwing.
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  const noDatabase = !hasDatabase();

  const [db, parser, jobs, recentFailedJobs, slowApiCalls] = await Promise.all([
    pingDatabase(),
    parserHealth(),
    jobsHealth(),
    getRecentFailedJobs(),
    getSlowApiCalls(),
  ]);

  // App: this code is executing, so the web app itself is up.
  const app: ServiceHealth = {
    key: "app",
    name: "Web app",
    status: "operational",
    detail: "Next.js — serving requests",
  };

  // Database: reachable + latency, or down. (No DB configured → "down" honestly,
  // since the app expects one in any real environment.)
  const database: ServiceHealth = {
    key: "database",
    name: "Database",
    status: noDatabase ? "down" : db.ok ? "operational" : "down",
    detail: noDatabase
      ? "No DATABASE_URL configured"
      : db.ok
        ? "Postgres (Neon) · " + (db.latencyMs ?? "—") + "ms"
        : "Unreachable",
  };

  const auth: ServiceHealth = {
    key: "auth",
    name: "Authentication",
    status: "operational",
    detail: "Better Auth",
  };

  const email: ServiceHealth = {
    key: "email",
    name: "Email delivery",
    status: Boolean(process.env.RESEND_API_KEY) ? "operational" : "disabled",
    detail: Boolean(process.env.RESEND_API_KEY) ? "Resend" : "Resend — not configured",
  };

  const billing: ServiceHealth = {
    key: "billing",
    name: "Billing",
    status: Boolean(process.env.STRIPE_SECRET_KEY) ? "operational" : "disabled",
    detail: Boolean(process.env.STRIPE_SECRET_KEY)
      ? "Stripe (test)"
      : "Stripe (test) — not configured",
  };

  // Storage: image/object storage isn't wired in this build. Honest "disabled"
  // when no provider env is present, "operational" only if one clearly is.
  const hasStorage = Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      process.env.S3_BUCKET ||
      process.env.AWS_S3_BUCKET ||
      process.env.R2_BUCKET ||
      process.env.CLOUDINARY_URL,
  );
  const storage: ServiceHealth = {
    key: "storage",
    name: "Image storage",
    status: hasStorage ? "operational" : "disabled",
    detail: hasStorage ? "Object storage configured" : "Not configured",
  };

  const services: ServiceHealth[] = [
    app,
    database,
    auth,
    parser,
    jobs,
    email,
    billing,
    storage,
  ];

  const commitHash =
    process.env.COMMIT_REF?.slice(0, 8) ??
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ??
    null;

  return {
    noDatabase,
    services,
    worstStatus: worstOf(services),
    dbLatencyMs: db.latencyMs,
    commitHash,
    environment: process.env.NODE_ENV ?? "unknown",
    uptime: null, // Not tracked in this build — shown as "—" with a note.
    recentErrors: null, // No error-capture pipeline wired — shown as "none captured".
    recentFailedJobs,
    slowApiCalls,
  };
}
