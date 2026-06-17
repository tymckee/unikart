/**
 * UniKart Ops — background job observability.
 *
 * `recordJobRun()` and `trackJob()` write JobRun rows so the Jobs page can show
 * recent runs, durations, and failure rates for the real background work
 * (price/stock checks, enrichment, notifications, cleanup).
 *
 * Best-effort — never throws into the caller.
 */
import { hasDatabase, prisma } from "../db";
import { safeJson } from "./sanitize";

export type JobType =
  | "price_check"
  | "stock_check"
  | "parser"
  | "notification"
  | "cleanup"
  | "billing_sync"
  | "email";

export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export interface JobRunInput {
  jobType: JobType | (string & {});
  status?: JobStatus;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  durationMs?: number | null;
  itemsProcessed?: number;
  itemsSucceeded?: number;
  itemsFailed?: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
}

/** Append a single job-run record (already-completed work). Returns its id. */
export async function recordJobRun(input: JobRunInput): Promise<string | null> {
  if (!hasDatabase()) return null;
  try {
    const row = await prisma.jobRun.create({
      data: {
        jobType: input.jobType,
        status: input.status ?? "succeeded",
        startedAt: input.startedAt ?? null,
        finishedAt: input.finishedAt ?? null,
        durationMs: input.durationMs ?? null,
        itemsProcessed: input.itemsProcessed ?? 0,
        itemsSucceeded: input.itemsSucceeded ?? 0,
        itemsFailed: input.itemsFailed ?? 0,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage?.slice(0, 1000) ?? null,
        metadataJson: safeJson(input.metadata),
        createdBy: input.createdBy ?? null,
      },
      select: { id: true },
    });
    return row.id;
  } catch (e) {
    console.error("[ops] recordJobRun failed:", e);
    return null;
  }
}

/**
 * Run a job, timing it and recording a JobRun row with the outcome. The work
 * receives a mutable `counters` object it can update (itemsProcessed, etc.).
 */
export async function trackJob<T>(
  jobType: JobType | (string & {}),
  work: (counters: {
    itemsProcessed: number;
    itemsSucceeded: number;
    itemsFailed: number;
  }) => Promise<T>,
  opts: { createdBy?: string | null; metadata?: Record<string, unknown> } = {},
): Promise<T> {
  const startedAt = new Date();
  const counters = { itemsProcessed: 0, itemsSucceeded: 0, itemsFailed: 0 };
  try {
    const result = await work(counters);
    const finishedAt = new Date();
    void recordJobRun({
      jobType,
      status: "succeeded",
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      ...counters,
      createdBy: opts.createdBy ?? null,
      metadata: opts.metadata,
    });
    return result;
  } catch (e) {
    const finishedAt = new Date();
    void recordJobRun({
      jobType,
      status: "failed",
      startedAt,
      finishedAt,
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      ...counters,
      errorMessage: e instanceof Error ? e.message : String(e),
      createdBy: opts.createdBy ?? null,
      metadata: opts.metadata,
    });
    throw e;
  }
}
