"use server";

/**
 * UniKart Ops — Feature flag server actions.
 *
 * Every mutation here gates on featureFlags.mutate, records an audit row with a
 * before/after snapshot, and revalidates the page. Flags are pure configuration
 * (no PII beyond the operator-entered allow/deny emails, which are stored as
 * given), so there are no secrets to redact.
 *
 * Actions:
 *   toggleFlag(key, enabled)        → flip a flag on/off (kill switch included)
 *   setRollout(key, percent 0..100) → clamp + set the gradual rollout percentage
 *   setAllowlist(key, emails[])     → replace the always-on allowlist
 *   setDenylist(key, emails[])      → replace the always-off denylist
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOpsPermission } from "@/lib/ops/guard";
import { recordAdminAudit } from "@/lib/ops/audit";
import type { OpsActionResult } from "@/lib/ops/types";

const PAGE = "/ops/feature-flags";

/** Normalise + de-duplicate a list of entries (emails / ids). Order preserved. */
function cleanList(entries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of entries ?? []) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (!value) continue;
    const dedupeKey = value.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(value);
  }
  return out;
}

/**
 * Toggle a flag on or off. The maintenance_mode kill switch flows through the
 * same path — its emergency framing lives in the UI (a confirm dialog), not in a
 * separate code path, so the audit trail is uniform.
 */
export async function toggleFlag(
  key: string,
  enabled: boolean,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("featureFlags.mutate");
  if (!gate.ok) return gate;
  // The success branch carries the viewer; the union with OpsActionResult<never>
  // (also `ok: true`) blocks auto-narrowing, so capture it explicitly.
  const viewer = ("viewer" in gate ? gate.viewer : null)!;

  if (!key || typeof key !== "string") {
    return { ok: false, reason: "invalid", message: "Missing flag key." };
  }

  try {
    const before = await prisma.featureFlag.findUnique({
      where: { key },
      select: { key: true, name: true, enabled: true },
    });
    if (!before) {
      return { ok: false, reason: "not-found", message: "That flag no longer exists." };
    }

    await prisma.featureFlag.update({
      where: { key },
      data: { enabled },
    });

    await recordAdminAudit({
      actor: viewer,
      action: "feature_flag.toggle",
      targetType: "feature_flag",
      targetId: key,
      before: { enabled: before.enabled },
      after: { enabled },
    });

    revalidatePath(PAGE);
    return {
      ok: true,
      message: (before.name || key) + (enabled ? " turned on." : " turned off."),
    };
  } catch (e) {
    console.error("[ops] toggleFlag failed:", e);
    return { ok: false, reason: "error", message: "Couldn't update the flag." };
  }
}

/**
 * Set the gradual-rollout percentage (0–100). Out-of-range or non-numeric input
 * is clamped to the valid range rather than rejected, so a stray value can't
 * leave a flag in an undefined state.
 */
export async function setRollout(
  key: string,
  percent: number,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("featureFlags.mutate");
  if (!gate.ok) return gate;
  const viewer = ("viewer" in gate ? gate.viewer : null)!;

  if (!key || typeof key !== "string") {
    return { ok: false, reason: "invalid", message: "Missing flag key." };
  }

  const n = Number(percent);
  if (!Number.isFinite(n)) {
    return { ok: false, reason: "invalid", message: "Rollout must be a number between 0 and 100." };
  }
  const clamped = Math.min(100, Math.max(0, Math.round(n)));

  try {
    const before = await prisma.featureFlag.findUnique({
      where: { key },
      select: { name: true, rolloutPercent: true },
    });
    if (!before) {
      return { ok: false, reason: "not-found", message: "That flag no longer exists." };
    }

    await prisma.featureFlag.update({
      where: { key },
      data: { rolloutPercent: clamped },
    });

    await recordAdminAudit({
      actor: viewer,
      action: "feature_flag.rollout",
      targetType: "feature_flag",
      targetId: key,
      before: { rolloutPercent: before.rolloutPercent },
      after: { rolloutPercent: clamped },
    });

    revalidatePath(PAGE);
    return { ok: true, message: "Rollout set to " + clamped + "%." };
  } catch (e) {
    console.error("[ops] setRollout failed:", e);
    return { ok: false, reason: "error", message: "Couldn't update the rollout." };
  }
}

/**
 * Replace the allowlist (entries for whom the flag is always on, regardless of
 * the rollout percentage). Entries are normalised and de-duplicated.
 */
export async function setAllowlist(
  key: string,
  emails: string[],
): Promise<OpsActionResult> {
  return setList("allowlist", key, emails);
}

/**
 * Replace the denylist (entries for whom the flag is always off, regardless of
 * the rollout percentage). Entries are normalised and de-duplicated.
 */
export async function setDenylist(
  key: string,
  emails: string[],
): Promise<OpsActionResult> {
  return setList("denylist", key, emails);
}

/** Shared implementation for the allow/deny list setters. */
async function setList(
  kind: "allowlist" | "denylist",
  key: string,
  emails: string[],
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("featureFlags.mutate");
  if (!gate.ok) return gate;
  const viewer = ("viewer" in gate ? gate.viewer : null)!;

  if (!key || typeof key !== "string") {
    return { ok: false, reason: "invalid", message: "Missing flag key." };
  }

  const cleaned = cleanList(emails);
  const json = JSON.stringify(cleaned);
  const column = kind === "allowlist" ? "allowlistJson" : "denylistJson";

  try {
    const before = await prisma.featureFlag.findUnique({
      where: { key },
      select: { allowlistJson: true, denylistJson: true },
    });
    if (!before) {
      return { ok: false, reason: "not-found", message: "That flag no longer exists." };
    }

    await prisma.featureFlag.update({
      where: { key },
      data: { [column]: json },
    });

    const beforeJson = kind === "allowlist" ? before.allowlistJson : before.denylistJson;
    await recordAdminAudit({
      actor: viewer,
      action: kind === "allowlist" ? "feature_flag.allowlist" : "feature_flag.denylist",
      targetType: "feature_flag",
      targetId: key,
      before: { [column]: beforeJson },
      after: { [column]: json },
    });

    revalidatePath(PAGE);
    const label = kind === "allowlist" ? "Allowlist" : "Denylist";
    const count = cleaned.length;
    return {
      ok: true,
      message:
        label + " updated — " + count + (count === 1 ? " entry." : " entries."),
    };
  } catch (e) {
    console.error("[ops] setList (" + kind + ") failed:", e);
    return { ok: false, reason: "error", message: "Couldn't update the " + kind + "." };
  }
}
