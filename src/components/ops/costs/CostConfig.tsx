"use client";

/**
 * UniKart Ops — cost rate editor.
 *
 * Shows the configurable per-unit cost *estimates* and lets an operator with
 * costs.mutate edit them. These are assumptions, not invoices — labelled clearly
 * as estimates. Saving runs the updateCostRates server action through an
 * OpsReasonDialog (the reason lands in the audit log). Read-only operators see
 * the same table without the editor controls.
 */
import { useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { OpsReasonDialog } from "@/components/ops/OpsReasonDialog";
import { usd } from "@/lib/ops/format";
import type { OpsActionResult } from "@/lib/ops/types";
import type { CostRate } from "@/lib/ops/data/costs";

interface CostConfigProps {
  rates: CostRate[];
  canEdit: boolean;
  /** Bound server action: (rates, reason) => result. Passed from the server page. */
  updateAction: (
    rates: Record<string, number>,
    reason: string,
  ) => Promise<OpsActionResult>;
}

export function CostConfig({ rates, canEdit, updateAction }: CostConfigProps) {
  // Local draft of edited values, keyed by rate key (string form of the input).
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const dirty = useMemo(() => {
    const out: Record<string, number> = {};
    for (const rate of rates) {
      const raw = drafts[rate.key];
      if (raw == null) continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) continue;
      if (Math.abs(n - rate.unitCostUsd) > 1e-9) out[rate.key] = n;
    }
    return out;
  }, [drafts, rates]);

  const dirtyCount = Object.keys(dirty).length;
  const hasInvalid = rates.some((rate) => {
    const raw = drafts[rate.key];
    if (raw == null || raw === "") return false;
    const n = Number(raw);
    return !Number.isFinite(n) || n < 0;
  });

  function reset() {
    setDrafts({});
  }

  return (
    <GlassCard className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink">
            Cost estimates
          </h3>
          <p className="mt-0.5 max-w-prose text-xs text-slate">
            Configurable per-unit assumptions used to estimate spend. Editing these
            changes future estimates and the figures on this page — it never alters
            recorded ledger entries.
          </p>
        </div>
        <Pill tone="warn">Estimates</Pill>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-medium text-slate">
              <th scope="col" className="px-5 py-2.5">Rate</th>
              <th scope="col" className="px-4 py-2.5">Provider</th>
              <th scope="col" className="px-4 py-2.5">Unit</th>
              <th scope="col" className="px-4 py-2.5 text-right">Cost per unit (USD)</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((rate) => {
              const raw = drafts[rate.key];
              const invalid =
                raw != null && raw !== "" && (!Number.isFinite(Number(raw)) || Number(raw) < 0);
              const changed = rate.key in dirty;
              return (
                <tr
                  key={rate.key}
                  className="border-b border-line/70 align-middle last:border-0"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{rate.key}</span>
                      {rate.overridden && <Pill tone="accent">Custom</Pill>}
                    </div>
                    <p className="mt-0.5 max-w-prose text-xs text-slate">{rate.note}</p>
                  </td>
                  <td className="px-4 py-3 text-slate">{rate.provider}</td>
                  <td className="px-4 py-3 text-slate">{rate.unit}</td>
                  <td className="px-4 py-3 text-right">
                    {canEdit ? (
                      <div className="inline-flex flex-col items-end gap-1">
                        <div
                          className={
                            "flex h-9 w-36 items-center gap-1 rounded-full border bg-white px-3 shadow-soft transition-colors focus-within:border-accent/60 " +
                            (invalid
                              ? "border-up"
                              : changed
                                ? "border-accent/60"
                                : "border-line")
                          }
                        >
                          <span className="text-xs text-silver">$</span>
                          <input
                            type="number"
                            min={0}
                            step="0.0001"
                            inputMode="decimal"
                            aria-label={"Cost per " + rate.unit + " for " + rate.key}
                            defaultValue={rate.unitCostUsd}
                            onChange={(e) =>
                              setDrafts((d) => ({ ...d, [rate.key]: e.target.value }))
                            }
                            className="min-w-0 flex-1 bg-transparent text-right text-sm tabular-nums text-ink focus:outline-none"
                          />
                        </div>
                        {invalid && (
                          <span className="text-[0.625rem] text-up">
                            Enter a number ≥ 0
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="tabular-nums text-ink">{usd(rate.unitCostUsd)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4">
          <p className="text-xs text-slate">
            {dirtyCount > 0
              ? dirtyCount + (dirtyCount === 1 ? " estimate changed" : " estimates changed")
              : "No changes."}
          </p>
          <div className="flex items-center gap-2">
            {dirtyCount > 0 && (
              <Button variant="ghost" size="sm" onClick={reset}>
                Reset
              </Button>
            )}
            <OpsReasonDialog
              title="Update cost estimates"
              description="These are configurable assumptions, not invoices. The change is recorded in the audit log."
              confirmLabel="Save estimates"
              reasonLabel="Reason"
              reasonPlaceholder="Why are these estimates changing? (recorded in the audit log)"
              action={(reason) => updateAction(dirty, reason)}
              successMessage="Cost estimates updated."
              trigger={(open) => (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={open}
                  disabled={dirtyCount === 0 || hasInvalid}
                >
                  Save estimates
                </Button>
              )}
            />
          </div>
        </div>
      )}
    </GlassCard>
  );
}
