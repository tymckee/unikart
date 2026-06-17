"use server";

/**
 * UniKart Ops — Costs server actions.
 *
 * The only mutation here is editing the per-unit cost *estimates* (rates). These
 * are configurable assumptions, persisted in the SystemSetting "cost.rates" row;
 * they don't change historical ledger rows, only how future estimates and the
 * dashboard's reference rates are computed. Every mutation gates on costs.mutate
 * and writes an audit row with before/after.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOpsPermission } from "@/lib/ops/guard";
import { recordAdminAudit } from "@/lib/ops/audit";
import { DEFAULT_COST_RATES } from "@/lib/ops/cost";
import type { OpsActionResult } from "@/lib/ops/types";

/** Map of rateKey → new unit cost (USD). Only known keys are persisted. */
export type RateUpdate = Record<string, number>;

/**
 * Update one or more per-unit cost rates. Stored as overrides in SystemSetting
 * "cost.rates" (valueJson = { [key]: { unitCostUsd } }). Keys not in
 * DEFAULT_COST_RATES are ignored; negative / non-finite values are rejected.
 */
export async function updateCostRates(
  rates: RateUpdate,
  reason: string,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("costs.mutate");
  if (!gate.ok) return gate;
  // requireOpsPermission's success branch carries the viewer; the union with
  // OpsActionResult<never> means TS can't auto-narrow, so capture it explicitly.
  const viewer = ("viewer" in gate ? gate.viewer : null)!;

  // Validate + clamp to known keys and sane values.
  const clean: Record<string, { unitCostUsd: number }> = {};
  for (const [key, value] of Object.entries(rates ?? {})) {
    if (!(key in DEFAULT_COST_RATES)) continue;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      return { ok: false, reason: "invalid", message: "Rates must be zero or a positive number." };
    }
    // Cap precision to 6 decimal places (matches the ledger's rounding).
    clean[key] = { unitCostUsd: Math.round(n * 1e6) / 1e6 };
  }

  if (Object.keys(clean).length === 0) {
    return { ok: false, reason: "invalid", message: "No valid rates to update." };
  }

  try {
    const existing = await prisma.systemSetting.findUnique({
      where: { key: "cost.rates" },
      select: { valueJson: true },
    });

    let before: Record<string, { unitCostUsd: number }> = {};
    if (existing?.valueJson) {
      try {
        const parsed = JSON.parse(existing.valueJson);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          before = parsed as Record<string, { unitCostUsd: number }>;
        }
      } catch {
        before = {};
      }
    }

    const after = { ...before, ...clean };
    const valueJson = JSON.stringify(after);

    await prisma.systemSetting.upsert({
      where: { key: "cost.rates" },
      create: {
        key: "cost.rates",
        valueJson,
        category: "costs",
        description: "Per-unit cost estimates (USD) used by the Costs dashboard.",
        updatedById: viewer.id,
      },
      update: { valueJson, category: "costs", updatedById: viewer.id },
    });

    await recordAdminAudit({
      actor: viewer,
      action: "cost.rates.update",
      targetType: "system",
      targetId: "cost.rates",
      reason,
      before,
      after,
    });

    revalidatePath("/ops/costs");
    return { ok: true, message: "Cost estimates updated." };
  } catch (e) {
    console.error("[ops] updateCostRates failed:", e);
    return { ok: false, reason: "error", message: "Couldn't save the estimates." };
  }
}
