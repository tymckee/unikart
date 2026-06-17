"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquarePlus,
  RefreshCw,
  Bell,
  Download,
  Trash2,
  Link2,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { useOpsToast } from "@/components/ops/OpsToast";
import { OpsReasonDialog } from "@/components/ops/OpsReasonDialog";
import type { OpsActionResult } from "@/lib/ops/types";

interface Operator {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface SupportActionsProps {
  ticketId: string;
  userId: string | null;
  hasProduct: boolean;
  status: string;
  assignedToId: string | null;
  operators: Operator[];
  /** Permission gates, resolved on the server and passed in as props. */
  canWrite: boolean;
  /* Bound server actions (passed from the server detail page). */
  addNote: (
    ticketId: string,
    body: string,
    visibility: "internal" | "customer",
  ) => Promise<OpsActionResult>;
  setStatus: (ticketId: string, status: string) => Promise<OpsActionResult>;
  assignTicket: (ticketId: string, assignedToId: string) => Promise<OpsActionResult>;
  linkTicket: (
    ticketId: string,
    links: { userId?: string; productId?: string },
  ) => Promise<OpsActionResult>;
  triggerParseRetry: (ticketId: string) => Promise<OpsActionResult>;
  triggerNotificationResend: (ticketId: string) => Promise<OpsActionResult>;
  queueAccountAction: (
    ticketId: string,
    userId: string,
    type: "export" | "delete",
  ) => Promise<OpsActionResult>;
}

const STATUSES: { value: string; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "pending", label: "Pending" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const selectClass =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none transition-colors focus:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const inputClass =
  "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-silver focus:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function SupportActions(props: SupportActionsProps) {
  const {
    ticketId,
    userId,
    hasProduct,
    status,
    assignedToId,
    operators,
    canWrite,
    addNote,
    setStatus,
    assignTicket,
    linkTicket,
    triggerParseRetry,
    triggerNotificationResend,
    queueAccountAction,
  } = props;

  const router = useRouter();
  const toast = useOpsToast();
  const [pending, startTransition] = useTransition();

  // Note composer
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<"internal" | "customer">("internal");

  // Status / assignment selects
  const [statusValue, setStatusValue] = useState(status);
  const [assigneeValue, setAssigneeValue] = useState(assignedToId ?? "");

  // Link fields
  const [linkUserId, setLinkUserId] = useState("");
  const [linkProductId, setLinkProductId] = useState("");

  if (!canWrite) {
    return (
      <GlassCard className="p-5">
        <h3 className="text-sm font-semibold tracking-tight text-ink">Actions</h3>
        <p className="mt-2 text-sm text-slate">
          Your role can view this ticket but cannot change it.
        </p>
      </GlassCard>
    );
  }

  /** Run a bound action, toast the result, refresh on success. */
  function run(
    fn: () => Promise<OpsActionResult>,
    onSuccess?: () => void,
  ) {
    startTransition(async () => {
      try {
        const result = await fn();
        if (result.ok) {
          toast.success(result.message ?? "Done.");
          onSuccess?.();
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
    <div className="space-y-4">
      {/* Email note — honesty banner */}
      <p className="rounded-xl bg-canvas px-3 py-2 text-xs text-slate text-pretty">
        Customer email isn&apos;t integrated yet. Replies to the customer are
        sent manually for now — notes here are the internal record.
      </p>

      {/* Add note */}
      <GlassCard className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <MessageSquarePlus size={16} className="text-slate" />
          <h3 className="text-sm font-semibold tracking-tight text-ink">Add a note</h3>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Internal note, or the reply you intend to send the customer"
          className="w-full resize-none rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-silver focus:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-full border border-line p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setVisibility("internal")}
              className={
                "rounded-full px-3 py-1 transition-colors " +
                (visibility === "internal"
                  ? "bg-ink text-white"
                  : "text-slate hover:text-ink")
              }
            >
              Internal
            </button>
            <button
              type="button"
              onClick={() => setVisibility("customer")}
              className={
                "rounded-full px-3 py-1 transition-colors " +
                (visibility === "customer"
                  ? "bg-ink text-white"
                  : "text-slate hover:text-ink")
              }
            >
              Customer reply
            </button>
          </div>
          <Button
            variant="primary"
            size="sm"
            loading={pending}
            disabled={note.trim().length === 0}
            onClick={() =>
              run(
                () => addNote(ticketId, note.trim(), visibility),
                () => setNote(""),
              )
            }
          >
            Add note
          </Button>
        </div>
      </GlassCard>

      {/* Status + assignment */}
      <GlassCard className="p-5">
        <h3 className="mb-3 text-sm font-semibold tracking-tight text-ink">
          Status &amp; assignment
        </h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate">Status</label>
            <div className="flex gap-2">
              <select
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value)}
                className={selectClass}
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                loading={pending}
                disabled={statusValue === status}
                onClick={() => run(() => setStatus(ticketId, statusValue))}
              >
                Update
              </Button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate">
              Assigned to
            </label>
            <div className="flex gap-2">
              <select
                value={assigneeValue}
                onChange={(e) => setAssigneeValue(e.target.value)}
                className={selectClass}
              >
                <option value="">Unassigned</option>
                {operators.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name || o.email} · {o.role}
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                loading={pending}
                disabled={assigneeValue === (assignedToId ?? "")}
                onClick={() => run(() => assignTicket(ticketId, assigneeValue))}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Link user / product */}
      <GlassCard className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Link2 size={16} className="text-slate" />
          <h3 className="text-sm font-semibold tracking-tight text-ink">Link records</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate">User id</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={linkUserId}
                onChange={(e) => setLinkUserId(e.target.value)}
                placeholder={userId ? "Replace linked user" : "Paste a user id"}
                className={inputClass + " font-mono text-[0.8125rem]"}
              />
              <Button
                variant="secondary"
                size="sm"
                loading={pending}
                disabled={linkUserId.trim().length === 0}
                onClick={() =>
                  run(
                    () => linkTicket(ticketId, { userId: linkUserId.trim() }),
                    () => setLinkUserId(""),
                  )
                }
              >
                Link
              </Button>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate">
              Product id
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={linkProductId}
                onChange={(e) => setLinkProductId(e.target.value)}
                placeholder={hasProduct ? "Replace linked product" : "Paste a product id"}
                className={inputClass + " font-mono text-[0.8125rem]"}
              />
              <Button
                variant="secondary"
                size="sm"
                loading={pending}
                disabled={linkProductId.trim().length === 0}
                onClick={() =>
                  run(
                    () => linkTicket(ticketId, { productId: linkProductId.trim() }),
                    () => setLinkProductId(""),
                  )
                }
              >
                Link
              </Button>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Tooling actions */}
      <GlassCard className="p-5">
        <h3 className="mb-1 text-sm font-semibold tracking-tight text-ink">Tooling</h3>
        <p className="mb-3 text-xs text-slate text-pretty">
          These queue background work — they don&apos;t email the customer. The
          parser and notification pipelines pick up queued jobs.
        </p>
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            disabled={!hasProduct}
            onClick={() => run(() => triggerParseRetry(ticketId))}
            className="justify-start"
          >
            <RefreshCw size={15} /> Reparse linked product
          </Button>
          {!hasProduct && (
            <p className="-mt-1 pl-1 text-xs text-silver">
              Link a product to enable a reparse.
            </p>
          )}
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onClick={() => run(() => triggerNotificationResend(ticketId))}
            className="justify-start"
          >
            <Bell size={15} /> Resend latest notification
          </Button>
        </div>
      </GlassCard>

      {/* Privacy / account actions */}
      <GlassCard className="p-5">
        <h3 className="mb-1 text-sm font-semibold tracking-tight text-ink">
          Privacy requests
        </h3>
        <p className="mb-3 text-xs text-slate text-pretty">
          Queue a data export or account deletion on the customer&apos;s behalf.
          These require a linked user and are always available — privacy controls
          are
          never restricted.
        </p>
        {userId ? (
          <div className="flex flex-col gap-2">
            <OpsReasonDialog
              title="Queue data export"
              description="Creates a data-export request for the linked user. They are not charged and not emailed by this tool."
              confirmLabel="Queue export"
              reasonLabel="Reason"
              reasonPlaceholder="Why is this export being queued? (recorded in the audit log)"
              action={() => queueAccountAction(ticketId, userId, "export")}
              successMessage="Data export queued."
              trigger={(open) => (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={open}
                  className="justify-start"
                >
                  <Download size={15} /> Queue data export
                </Button>
              )}
            />
            <OpsReasonDialog
              title="Queue account deletion"
              description="Creates an account-deletion request for the linked user. This is irreversible once processed. The customer is not emailed by this tool."
              confirmLabel="Queue deletion"
              danger
              reasonLabel="Reason"
              reasonPlaceholder="Why is deletion being queued? (recorded in the audit log)"
              action={() => queueAccountAction(ticketId, userId, "delete")}
              successMessage="Account deletion queued."
              trigger={(open) => (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={open}
                  className="justify-start text-up"
                >
                  <Trash2 size={15} /> Queue account deletion
                </Button>
              )}
            />
          </div>
        ) : (
          <p className="text-sm text-slate">Link a user to queue privacy requests.</p>
        )}
      </GlassCard>
    </div>
  );
}
