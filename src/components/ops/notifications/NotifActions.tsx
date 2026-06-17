"use client";

/**
 * UniKart Ops — Notifications client actions.
 *
 * Server-action functions are passed in as props from the server page (no DB or
 * prisma imports here). Three pieces:
 *   - <NotifRowActions />     kebab menu per notification: resend (intent only),
 *                             mark reviewed, preview the template.
 *   - <TemplatePreview />     a standalone "Preview template" trigger + modal
 *                             rendering a calm sample of a given type's copy.
 *   - <TemplateManager />     page-level control: pick a template, preview it,
 *                             and pause/resume it (reason captured for the audit).
 *
 * All mutations go through the audited, permission-gated server actions and show
 * a calm toast on completion. Sample copy follows the brand voice — plain,
 * unhurried, no exclamation marks, no hype.
 */
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, CheckCheck, Eye, SlidersHorizontal } from "lucide-react";
import { OpsActionMenu } from "@/components/ops/OpsActionMenu";
import { OpsConfirmDialog } from "@/components/ops/OpsConfirmDialog";
import { OpsReasonDialog } from "@/components/ops/OpsReasonDialog";
import { OpsStatusPill } from "@/components/ops/OpsStatusPill";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import type { OpsActionResult } from "@/lib/ops/types";

/* ---- Shared type metadata (kept local — sections are independent) ---- */

const TYPE_LABELS: Record<string, string> = {
  price_dropped: "Price dropped",
  target_reached: "Target reached",
  back_in_stock: "Back in stock",
  out_of_stock: "Out of stock",
  price_increased: "Price increased",
  cart_reminder: "Cart reminder",
  checkout_incomplete: "Checkout incomplete",
  weekly_review: "Weekly review",
};

export const NOTIF_TYPE_OPTIONS: { value: string; label: string }[] = Object.entries(
  TYPE_LABELS,
).map(([value, label]) => ({ value, label }));

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

/**
 * Calm, on-brand sample copy for each template (no exclamation marks, no hype,
 * no urgency). These are illustrative samples for operators previewing a
 * template — they use a placeholder item so nothing is fabricated about a real
 * product. The Signal line stays "based on tracked price history".
 */
const TEMPLATE_SAMPLES: Record<string, { title: string; body: string }> = {
  price_dropped: {
    title: "The price dropped on a saved item",
    body: "A product in your Hub is now lower than when you saved it. We've updated the price from your tracked history. No reason to rush — we'll keep watching.",
  },
  target_reached: {
    title: "A saved item reached your target price",
    body: "Something you're considering is now at or below the target you set. Based on tracked price history, this is a calm moment to take a look. This isn't financial advice.",
  },
  back_in_stock: {
    title: "A saved item is back in stock",
    body: "A product you've been considering is available again. It's waiting in your Hub whenever you're ready.",
  },
  out_of_stock: {
    title: "A saved item is out of stock",
    body: "A product in your Hub is currently unavailable. We'll let you know quietly if it returns. Nothing to do for now.",
  },
  price_increased: {
    title: "The price went up on a saved item",
    body: "A product you're tracking is higher than when you saved it. We've noted the change from your price history so you have the full picture.",
  },
  cart_reminder: {
    title: "Your Universal Cart is waiting",
    body: "A few items are sitting in your Universal Cart. They'll stay there until you decide. When you're ready, checkout stays on each store's own site.",
  },
  checkout_incomplete: {
    title: "You started a checkout",
    body: "You began checking out and stepped away — that's fine. Your selections are saved in your Universal Cart for whenever it feels right.",
  },
  weekly_review: {
    title: "Your weekly review is ready",
    body: "A calm summary of what moved this week across the items you're considering — prices, stock, and anything worth a second look. No pressure to act.",
  },
};

function sampleFor(type: string): { title: string; body: string } {
  return (
    TEMPLATE_SAMPLES[type] ?? {
      title: typeLabel(type),
      body: "A calm update about a saved item. We'll keep watching and let you know when something changes.",
    }
  );
}

/* ---- Template preview modal (shared) ---- */

function TemplatePreviewModal({
  type,
  open,
  onClose,
}: {
  type: string;
  open: boolean;
  onClose: () => void;
}) {
  const sample = sampleFor(type);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Preview template"
      description={"Sample copy for the " + typeLabel(type) + " notification"}
    >
      <div className="space-y-4 px-6 pb-6 pt-4">
        <p className="text-xs text-slate">
          An illustrative sample using a placeholder item — not a real customer
          notification. Live notifications fill in the actual product and price.
        </p>

        {/* A calm rendering of how the notification reads to a customer. */}
        <div className="rounded-2xl border border-line bg-canvas p-4 shadow-soft">
          <div className="flex items-center gap-2">
            <OpsStatusPill status="watchlisted" label={typeLabel(type)} />
          </div>
          <p className="mt-3 text-sm font-semibold tracking-tight text-ink">
            {sample.title}
          </p>
          <p className="mt-1.5 text-sm leading-relaxed text-slate text-pretty">
            {sample.body}
          </p>
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

/** Standalone "Preview template" trigger (used in the type breakdown list). */
export function TemplatePreview({ type }: { type: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs text-slate transition-colors hover:bg-canvas hover:text-ink"
      >
        <Eye size={14} /> Preview
      </button>
      <TemplatePreviewModal type={type} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/* ---- Per-row actions ---- */

interface NotifLite {
  id: string;
  type: string;
  read: boolean;
}

export function NotifRowActions({
  notif,
  canResend,
  resendNotification,
  markReviewed,
}: {
  notif: NotifLite;
  canResend: boolean;
  resendNotification: (id: string) => Promise<OpsActionResult>;
  markReviewed: (id: string) => Promise<OpsActionResult>;
}) {
  const [previewOpen, setPreviewOpen] = useState(false);
  // OpsConfirmDialog owns its open state and exposes an opener via its `trigger`
  // render prop. We capture those openers in refs and invoke them from the menu.
  const openResend = useRef<(() => void) | null>(null);
  const openReviewed = useRef<(() => void) | null>(null);

  return (
    <>
      <OpsActionMenu
        items={[
          {
            label: "Preview template",
            icon: <Eye size={15} />,
            onSelect: () => setPreviewOpen(true),
          },
          {
            label: "Resend",
            icon: <Send size={15} />,
            hidden: !canResend,
            onSelect: () => openResend.current?.(),
          },
          {
            label: "Mark reviewed",
            icon: <CheckCheck size={15} />,
            hidden: !canResend,
            onSelect: () => openReviewed.current?.(),
          },
        ]}
      />

      {/* Resend confirm — trigger renders nothing; opened from the menu. */}
      {canResend && (
        <OpsConfirmDialog
          trigger={(open) => {
            openResend.current = open;
            return null;
          }}
          title={"Resend " + typeLabel(notif.type)}
          description="This records a resend in the audit log. No email is sent from Ops in this version — delivery tracking beyond the read flag isn't captured yet."
          confirmLabel="Record resend"
          action={() => resendNotification(notif.id)}
          successMessage="Resend recorded."
        />
      )}

      {/* Mark reviewed confirm */}
      {canResend && (
        <OpsConfirmDialog
          trigger={(open) => {
            openReviewed.current = open;
            return null;
          }}
          title="Mark as reviewed"
          description="Records that you reviewed this notification. The customer's own read state is left untouched."
          confirmLabel="Mark reviewed"
          action={() => markReviewed(notif.id)}
          successMessage="Marked as reviewed."
        />
      )}

      <TemplatePreviewModal
        type={notif.type}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}

/* ---- Page-level template manager ---- */

export function TemplateManager({
  disabledTypes,
  canMutate,
  disableTemplate,
}: {
  /** Types currently paused (from SystemSetting "notifications.disabled.<type>"). */
  disabledTypes: string[];
  canMutate: boolean;
  disableTemplate: (
    type: string,
    disabled: boolean,
    reason: string,
  ) => Promise<OpsActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(NOTIF_TYPE_OPTIONS[0].value);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const disabledSet = new Set(disabledTypes);
  const isDisabled = disabledSet.has(type);

  function toggle(reason: string) {
    return new Promise<OpsActionResult>((resolve) => {
      startTransition(async () => {
        const result = await disableTemplate(type, !isDisabled, reason);
        if (result.ok) router.refresh();
        resolve(result);
      });
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <SlidersHorizontal size={15} /> Manage templates
      </Button>

      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Manage notification templates"
        description="Preview a template's copy, or pause a noisy one. Pausing is a kill switch the worker honors — it doesn't delete anything."
      >
        <div className="space-y-4 px-6 pb-6 pt-4">
          <label className="block">
            <span className="text-xs font-medium text-slate">Template</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {NOTIF_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center justify-between rounded-xl border border-line bg-canvas px-3.5 py-3">
            <div>
              <p className="text-sm font-medium text-ink">{typeLabel(type)}</p>
              <p className="mt-0.5 text-xs text-slate">
                {isDisabled
                  ? "Paused — the worker is skipping this template."
                  : "Active — the worker may send this template."}
              </p>
            </div>
            <Pill tone={isDisabled ? "neutral" : "down"} dot>
              {isDisabled ? "Paused" : "Active"}
            </Pill>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => setPreviewOpen(true)}>
              <Eye size={15} /> Preview
            </Button>
            {canMutate && (
              <OpsReasonDialog
                trigger={(openDialog) => (
                  <Button
                    variant={isDisabled ? "primary" : "danger"}
                    onClick={() => openDialog()}
                    loading={pending}
                  >
                    {isDisabled ? "Resume template" : "Pause template"}
                  </Button>
                )}
                title={
                  isDisabled
                    ? "Resume " + typeLabel(type)
                    : "Pause " + typeLabel(type)
                }
                description={
                  isDisabled
                    ? "The worker will be allowed to send this template again."
                    : "The worker will skip this template until it's resumed. Existing notifications are unaffected."
                }
                confirmLabel={isDisabled ? "Resume template" : "Pause template"}
                danger={!isDisabled}
                action={(reason) => toggle(reason)}
                successMessage={isDisabled ? "Template resumed." : "Template paused."}
              />
            )}
          </div>

          {!canMutate && (
            <p className="text-xs text-silver">
              Your role can preview templates but not pause them.
            </p>
          )}
        </div>
      </Modal>

      <TemplatePreviewModal
        type={type}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}
