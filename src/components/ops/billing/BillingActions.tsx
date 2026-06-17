"use client";

/**
 * UniKart Ops — Billing actions (disabled in v1).
 *
 * Stripe runs in test mode, so refunds, credits, and operator-initiated
 * cancellations are NOT live. This component renders those controls as clearly
 * disabled buttons labelled "Not live (test mode)" — no dark patterns, no fake
 * affordances. The corresponding server-action stubs are passed in as props for
 * the future v2 wiring, but nothing calls them while disabled.
 *
 * Read access stays available: an operator can still see the state. We never
 * render card data (there is none in this schema).
 */
import { Ban, RotateCcw, CircleDollarSign, XCircle } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils";
import type { OpsActionResult } from "@/lib/ops/types";

interface BillingActionsProps {
  /** Whether the viewer holds billing.refund (controls is informational only). */
  canRefund: boolean;
  /** Future v2 server-action stubs (gated + audited there). Unused while disabled. */
  refundAction: (subscriptionId: string, reason: string) => Promise<OpsActionResult>;
  applyCreditAction: (subscriptionId: string, reason: string) => Promise<OpsActionResult>;
  cancelAction: (subscriptionId: string, reason: string) => Promise<OpsActionResult>;
}

const ACTIONS = [
  {
    key: "refund",
    label: "Issue refund",
    icon: RotateCcw,
    description: "Refund a UniKart Coast charge back to the customer.",
  },
  {
    key: "credit",
    label: "Apply credit",
    icon: CircleDollarSign,
    description: "Add an account credit toward a future invoice.",
  },
  {
    key: "cancel",
    label: "Cancel subscription",
    icon: XCircle,
    description: "End a UniKart Coast subscription on the operator's behalf.",
  },
] as const;

export function BillingActions({
  canRefund,
  refundAction,
  applyCreditAction,
  cancelAction,
}: BillingActionsProps) {
  // The stubs are intentionally not invoked while the controls are disabled.
  // Referencing them keeps the props live for the v2 wiring without a no-unused
  // warning, and documents that they exist.
  void refundAction;
  void applyCreditAction;
  void cancelAction;

  return (
    <GlassCard className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink">
            Billing actions
          </h3>
          <p className="mt-0.5 text-xs text-slate text-pretty">
            Money-moving actions are not enabled while Stripe is in test mode.
            They will become available once billing goes live.
          </p>
        </div>
        <Pill tone="warn" dot>
          Test mode
        </Pill>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <div
              key={action.key}
              className="flex flex-col rounded-2xl border border-line bg-canvas/40 p-4"
            >
              <div className="flex items-center gap-2 text-ink">
                <Icon size={15} className="text-silver" />
                <span className="text-sm font-medium">{action.label}</span>
              </div>
              <p className="mt-1 mb-3 text-xs text-slate text-pretty">
                {action.description}
              </p>
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Not live in test mode"
                className={cn(
                  "mt-auto inline-flex h-9 cursor-not-allowed items-center justify-center gap-1.5",
                  "rounded-full border border-line px-4 text-[0.8125rem] font-medium text-silver opacity-70",
                )}
              >
                <Ban size={14} />
                Not live (test mode)
              </button>
            </div>
          );
        })}
      </div>

      {!canRefund && (
        <p className="mt-3 text-xs text-silver text-pretty">
          Your role would not have permission to run these actions even once they
          are live.
        </p>
      )}
    </GlassCard>
  );
}
