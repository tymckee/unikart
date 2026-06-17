"use client";

/**
 * UniKart Ops — Jobs client actions.
 *
 * Server-action functions are passed in as props from the server page (no DB or
 * prisma imports here). Three pieces:
 *   - <JobRowActions />    kebab menu per run: retry, cancel (queued only),
 *                          view logs (metadata + sanitized error in a Modal).
 *   - <RunManualCheck />   page-level control to enqueue a manual run by type.
 * All mutations go through the audited, permission-gated server actions and show
 * a calm toast on completion.
 */
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, RotateCcw, Ban, FileText } from "lucide-react";
import { OpsActionMenu } from "@/components/ops/OpsActionMenu";
import { OpsConfirmDialog } from "@/components/ops/OpsConfirmDialog";
import { OpsStatusPill } from "@/components/ops/OpsStatusPill";
import { useOpsToast } from "@/components/ops/OpsToast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { dateTime, duration, shortId } from "@/lib/ops/format";
import type { OpsActionResult } from "@/lib/ops/types";

interface JobRunLite {
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

const JOB_TYPE_LABELS: Record<string, string> = {
  price_check: "Price check",
  stock_check: "Stock check",
  parser: "Parser",
  notification: "Notification",
  cleanup: "Cleanup",
  billing_sync: "Billing sync",
  email: "Email",
};

function jobTypeLabel(type: string): string {
  return JOB_TYPE_LABELS[type] ?? type;
}

/** Pretty-print a JSON metadata blob; fall back to the raw string. */
function formatJson(raw: string | null): string | null {
  if (!raw) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

/* ---- Per-row actions ---- */

export function JobRowActions({
  job,
  canMutate,
  retryJob,
  cancelJob,
}: {
  job: JobRunLite;
  canMutate: boolean;
  retryJob: (jobId: string) => Promise<OpsActionResult>;
  cancelJob: (jobId: string) => Promise<OpsActionResult>;
}) {
  const [logsOpen, setLogsOpen] = useState(false);
  // OpsConfirmDialog owns its own open state and exposes an opener via its
  // `trigger` render prop. We capture those openers in refs and invoke them
  // from the kebab menu, so the menu and the confirm dialogs stay in sync.
  const openRetry = useRef<(() => void) | null>(null);
  const openCancel = useRef<(() => void) | null>(null);

  const metadata = formatJson(job.metadataJson);
  const isQueued = job.status === "queued";

  return (
    <>
      <OpsActionMenu
        items={[
          {
            label: "View logs",
            icon: <FileText size={15} />,
            onSelect: () => setLogsOpen(true),
          },
          {
            label: "Retry",
            icon: <RotateCcw size={15} />,
            hidden: !canMutate,
            onSelect: () => openRetry.current?.(),
          },
          {
            label: "Cancel run",
            icon: <Ban size={15} />,
            danger: true,
            hidden: !canMutate || !isQueued,
            onSelect: () => openCancel.current?.(),
          },
        ]}
      />

      {/* Retry confirm — trigger renders nothing visible; opened from the menu. */}
      {canMutate && (
        <OpsConfirmDialog
          trigger={(open) => {
            openRetry.current = open;
            return null;
          }}
          title={"Retry " + jobTypeLabel(job.jobType)}
          description="A fresh run is queued for the worker to pick up. The original record is kept."
          confirmLabel="Queue retry"
          action={() => retryJob(job.id)}
          successMessage="Retry queued."
        />
      )}

      {/* Cancel confirm */}
      {canMutate && isQueued && (
        <OpsConfirmDialog
          trigger={(open) => {
            openCancel.current = open;
            return null;
          }}
          title="Cancel this run"
          description="This queued run will be marked canceled and skipped by the worker."
          confirmLabel="Cancel run"
          danger
          action={() => cancelJob(job.id)}
          successMessage="Run canceled."
        />
      )}

      <JobLogsModal job={job} metadata={metadata} open={logsOpen} onClose={() => setLogsOpen(false)} />
    </>
  );
}

/* ---- Logs modal ---- */

function JobLogsModal({
  job,
  metadata,
  open,
  onClose,
}: {
  job: JobRunLite;
  metadata: string | null;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={jobTypeLabel(job.jobType) + " run"}
      description={"Run " + shortId(job.id)}
    >
      <div className="space-y-5 px-6 pb-6 pt-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <Field label="Status">
            <OpsStatusPill status={job.status} />
          </Field>
          <Field label="Started">
            <span className="tabular-nums text-ink">{dateTime(job.startedAt)}</span>
          </Field>
          <Field label="Duration">
            <span className="tabular-nums text-ink">{duration(job.durationMs)}</span>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Counter label="Processed" value={job.itemsProcessed} />
          <Counter label="Succeeded" value={job.itemsSucceeded} tone="down" />
          <Counter label="Failed" value={job.itemsFailed} tone={job.itemsFailed > 0 ? "up" : "ink"} />
        </div>

        {(job.errorCode || job.errorMessage) && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-slate">Error</p>
            <div className="rounded-xl bg-up-soft px-3 py-2.5 text-sm text-up">
              {job.errorCode && (
                <p className="font-mono text-xs text-up/90">{job.errorCode}</p>
              )}
              {job.errorMessage && (
                <p className="mt-1 whitespace-pre-wrap break-words">{job.errorMessage}</p>
              )}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-medium text-slate">Metadata</p>
          {metadata ? (
            <pre className="max-h-64 overflow-auto rounded-xl border border-line bg-canvas px-3 py-2.5 font-mono text-xs leading-relaxed text-ink">
              {metadata}
            </pre>
          ) : (
            <p className="text-sm text-silver">No metadata recorded.</p>
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-slate">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function Counter({
  label,
  value,
  tone = "ink",
}: {
  label: string;
  value: number;
  tone?: "ink" | "down" | "up";
}) {
  const toneClass =
    tone === "down" ? "text-down" : tone === "up" ? "text-up" : "text-ink";
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2.5">
      <p className="text-xs text-slate">{label}</p>
      <p className={"mt-0.5 text-lg font-semibold tabular-nums " + toneClass}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

/* ---- Page-level manual run ---- */

const MANUAL_TYPES: { value: string; label: string }[] = [
  { value: "price_check", label: "Price check" },
  { value: "stock_check", label: "Stock check" },
  { value: "parser", label: "Parser" },
  { value: "notification", label: "Notification" },
  { value: "cleanup", label: "Cleanup" },
  { value: "billing_sync", label: "Billing sync" },
  { value: "email", label: "Email" },
];

export function RunManualCheck({
  runManualCheck,
}: {
  runManualCheck: (jobType: string) => Promise<OpsActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [jobType, setJobType] = useState(MANUAL_TYPES[0].value);
  const [pending, startTransition] = useTransition();
  const toast = useOpsToast();
  const router = useRouter();

  function run() {
    startTransition(async () => {
      try {
        const result = await runManualCheck(jobType);
        if (result.ok) {
          toast.success(result.message ?? "Run queued.");
          setOpen(false);
          router.refresh();
        } else {
          toast.error(result.message ?? "That didn't work. Please try again.");
        }
      } catch {
        toast.error("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Play size={15} /> Run a check
      </Button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Run a manual check"
        description="The selected job is queued for the worker. Nothing runs inline here."
      >
        <div className="space-y-4 px-6 pb-6 pt-4">
          <label className="block">
            <span className="text-xs font-medium text-slate">Job type</span>
            <select
              value={jobType}
              onChange={(e) => setJobType(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {MANUAL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={run} loading={pending}>
              Queue run
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
