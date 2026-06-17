"use server";

/**
 * UniKart Ops — Settings server actions.
 *
 * The only mutation here is editing a non-secret SystemSetting. The value is
 * stored as JSON in valueJson, the editor's id is stamped on updatedById, and
 * every change records an audit row with a before/after snapshot. Gated on
 * settings.mutate.
 *
 * Secrets are never written here: SystemSetting is non-secret configuration
 * only, and this action never accepts or stores tokens, keys, or card data.
 * Only scalar values (string / number / boolean) are accepted — structured
 * config (e.g. cost.rates) is edited from its own page, not here.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOpsPermission } from "@/lib/ops/guard";
import { recordAdminAudit } from "@/lib/ops/audit";
import type { OpsActionResult } from "@/lib/ops/types";

const PAGE = "/ops/settings";

/**
 * Update one SystemSetting's value. Accepts only a scalar (string, number, or
 * boolean) — the inline editor never edits structured config. The value is
 * upserted as JSON; a non-existent key is created so seeding gaps self-heal.
 */
export async function updateSetting(
  key: string,
  value: unknown,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("settings.mutate");
  if (!gate.ok) return gate;
  // The success branch carries the viewer; the union with OpsActionResult<never>
  // (also `ok: true`) blocks auto-narrowing, so capture it explicitly.
  const viewer = ("viewer" in gate ? gate.viewer : null)!;

  if (!key || typeof key !== "string") {
    return { ok: false, reason: "invalid", message: "Missing setting key." };
  }

  // Only scalar values are editable here; structured config lives on its own
  // page. This also keeps the audit before/after readable.
  const scalar =
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean";
  if (!scalar) {
    return {
      ok: false,
      reason: "invalid",
      message: "Only text, number, or yes/no settings can be edited here.",
    };
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    return { ok: false, reason: "invalid", message: "Enter a valid number." };
  }

  const valueJson = JSON.stringify(value);

  try {
    const existing = await prisma.systemSetting.findUnique({
      where: { key },
      select: { valueJson: true, category: true, description: true },
    });

    let before: unknown = null;
    if (existing?.valueJson) {
      try {
        before = JSON.parse(existing.valueJson) as unknown;
      } catch {
        before = null;
      }
    }

    await prisma.systemSetting.upsert({
      where: { key },
      create: {
        key,
        valueJson,
        category: existing?.category ?? "general",
        description: existing?.description ?? "",
        updatedById: viewer.id,
      },
      update: { valueJson, updatedById: viewer.id },
    });

    await recordAdminAudit({
      actor: viewer,
      action: "system_setting.update",
      targetType: "system",
      targetId: key,
      before: { value: before },
      after: { value },
    });

    revalidatePath(PAGE);
    return { ok: true, message: "Setting saved." };
  } catch (e) {
    console.error("[ops] updateSetting failed:", e);
    return { ok: false, reason: "error", message: "Couldn't save the setting." };
  }
}
