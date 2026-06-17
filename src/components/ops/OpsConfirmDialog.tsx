"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useOpsToast } from "./OpsToast";
import type { OpsActionResult } from "@/lib/ops/types";

/**
 * Confirmation dialog for a sensitive mutation. Renders its own trigger, calls
 * the passed server action, shows a toast, and refreshes the route on success.
 * The action is audited server-side (every Ops mutation must be).
 */
export function OpsConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  danger = false,
  action,
  successMessage = "Done.",
  onDone,
}: {
  trigger: (open: () => void) => React.ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  action: () => Promise<OpsActionResult<unknown>>;
  successMessage?: string;
  onDone?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useOpsToast();
  const router = useRouter();

  function run() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.ok) {
          toast.success(result.message ?? successMessage);
          setOpen(false);
          onDone?.();
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
        setOpen(true);
      })}
      <Modal open={open} onClose={() => !pending && setOpen(false)} title={title} description={description}>
        <div className="px-6 pb-6 pt-4">
          {error && (
            <p className="mb-4 rounded-xl bg-up-soft px-3 py-2 text-sm text-up">{error}</p>
          )}
          <div className="flex justify-end gap-2">
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
