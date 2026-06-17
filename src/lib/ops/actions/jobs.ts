"use server";

/**
 * UniKart Ops — Jobs server actions (gated + audited).
 *
 * Every mutation: (1) gates via requireOpsPermission("jobs.mutate"),
 * (2) writes an AdminAuditLog row, (3) revalidates /ops/jobs, (4) returns a
 * typed OpsActionResult. These do NOT execute heavy background work inline — a
 * retry / manual check enqueues a fresh queued JobRun for the real worker to
 * pick up, and we return an honest "queued" message rather than faking a result.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOpsPermission } from "@/lib/ops/guard";
import { recordAdminAudit } from "@/lib/ops/audit";
import { recordJobRun } from "@/lib/ops/jobs";
import type { OpsActionResult, OpsViewer } from "@/lib/ops/types";

const JOB_TYPES = [
  "price_check",
  "stock_check",
  "parser",
  "notification",
  "cleanup",
  "billing_sync",
  "email",
] as const;

type JobType = (typeof JOB_TYPES)[number];

function isJobType(value: string): value is JobType {
  return (JOB_TYPES as readonly string[]).includes(value);
}

/**
 * Narrow the gate result to the granted viewer. `requireOpsPermission`'s success
 * branch and OpsActionResult's success branch both carry `ok: true`, so the `ok`
 * discriminant alone can't separate them — we narrow on the `viewer` field.
 */
type GrantedGate = { ok: true; viewer: OpsViewer };
function granted(
  gate: Awaited<ReturnType<typeof requireOpsPermission>>,
): gate is GrantedGate {
  return gate.ok && "viewer" in gate;
}

/**
 * Re-run a job: read the original, enqueue a fresh queued run of the same type
 * (attributed to the operator), and audit it. The real worker performs the work.
 */
export async function retryJob(jobId: string): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("jobs.mutate");
  if (!granted(gate)) return gate;
  const viewer = gate.viewer;
  try {
    const original = await prisma.jobRun.findUnique({
      where: { id: jobId },
      select: { id: true, jobType: true, status: true },
    });
    if (!original) return { ok: false, reason: "not-found", message: "Job run not found." };

    const newId = await recordJobRun({
      jobType: original.jobType,
      status: "queued",
      createdBy: viewer.id,
      metadata: { retryOf: original.id },
    });

    await recordAdminAudit({
      actor: viewer,
      action: "job.retry",
      targetType: "job_run",
      targetId: original.id,
      metadata: { jobType: original.jobType, queuedRunId: newId },
    });

    revalidatePath("/ops/jobs");
    return { ok: true, message: "Retry queued." };
  } catch (e) {
    console.error("[ops] retryJob failed:", e);
    return { ok: false, reason: "error" };
  }
}

/**
 * Cancel a job — only valid while it's still queued. A running/terminal run
 * can't be canceled from here (returns invalid).
 */
export async function cancelJob(jobId: string): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("jobs.mutate");
  if (!granted(gate)) return gate;
  const viewer = gate.viewer;
  try {
    const job = await prisma.jobRun.findUnique({
      where: { id: jobId },
      select: { id: true, jobType: true, status: true },
    });
    if (!job) return { ok: false, reason: "not-found", message: "Job run not found." };
    if (job.status !== "queued") {
      return {
        ok: false,
        reason: "invalid",
        message: "Only a queued run can be canceled.",
      };
    }

    await prisma.jobRun.update({
      where: { id: job.id },
      data: { status: "canceled", finishedAt: new Date() },
    });

    await recordAdminAudit({
      actor: viewer,
      action: "job.cancel",
      targetType: "job_run",
      targetId: job.id,
      before: { status: job.status },
      after: { status: "canceled" },
      metadata: { jobType: job.jobType },
    });

    revalidatePath("/ops/jobs");
    return { ok: true, message: "Run canceled." };
  } catch (e) {
    console.error("[ops] cancelJob failed:", e);
    return { ok: false, reason: "error" };
  }
}

/**
 * Manually enqueue a run of a given job type. Validates the type, enqueues a
 * queued JobRun for the worker, and audits the request. No heavy work inline.
 */
export async function runManualCheck(jobType: string): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("jobs.mutate");
  if (!granted(gate)) return gate;
  const viewer = gate.viewer;
  if (!isJobType(jobType)) {
    return { ok: false, reason: "invalid", message: "Unknown job type." };
  }
  try {
    const newId = await recordJobRun({
      jobType,
      status: "queued",
      createdBy: viewer.id,
      metadata: { trigger: "manual" },
    });

    await recordAdminAudit({
      actor: viewer,
      action: "job.manual_run",
      targetType: "job_run",
      targetId: newId,
      metadata: { jobType },
    });

    revalidatePath("/ops/jobs");
    return { ok: true, message: "Run queued." };
  } catch (e) {
    console.error("[ops] runManualCheck failed:", e);
    return { ok: false, reason: "error" };
  }
}
