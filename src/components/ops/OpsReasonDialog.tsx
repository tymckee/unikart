"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useOpsToast } from "./OpsToast";
import type { OpsActionResult } from "@/lib/ops/types";

/**
 * Dialog that captures a reason (and optional free text) before running a
 * sensitive mutation. The reason is stored on the audit log. Use for actions
 * that change another user's state (disable, role change, archive-on-behalf…).
 */
export function OpsReasonDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  danger = false,
  reasonLabel = "Reason",
  reasonPlaceholder = "Why are you making this change? (recorded in the audit log)",
  reasonRequired = true,
  action,
  successMessage = "Done.",
  extra,
}: {
  trigger: (open: () => void) => React.ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonRequired?: boolean;
  action: (reason: string) => Promise<OpsActionResult<unknown>>;
  successMessage?: string;
  /** Optional extra fields rendered above the reason box. */
  extra?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useOpsToast();
  const router = useRouter();

  function run() {
    if (reasonRequired && reason.trim().length < 3) {
      setError("Please add a short reason — it's recorded in the audit log.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const result = await action(reason.trim());
        if (result.ok) {
          toast.success(result.message ?? successMessage);
          setOpen(false);
          setReason("");
          router.refresh();
        } else {
          setError(result.message ?? "That didn't work. Please try again.");
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <>
      {trigger(() => {
        setError(null);
        setReason("");
        setOpen(true);
      })}
      <Modal open={open} onClose={() => !pending && setOpen(false)} title={title} description={description}>
        <div className="px-6 pb-6 pt-4">
          {extra && <div className="mb-4">{extra}</div>}
          <label className="mb-1.5 block text-xs font-medium text-slate">
            {reasonLabel}
            {!reasonRequired && <span className="text-silver"> (optional)</span>}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={reasonPlaceholder}
            rows={3}
            className="w-full resize-none rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-silver focus:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
          {error && <p className="mt-3 text-sm text-up">{error}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant={danger ? "danger" : "primary"} onClick={run} loading={pending}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
