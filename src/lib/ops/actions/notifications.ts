"use server";

/**
 * UniKart Ops — Notifications server actions (gated + audited).
 *
 * Every mutation: (1) gates via requireOpsPermission, (2) writes an
 * AdminAuditLog row with actor: gate.viewer, (3) revalidates /ops/notifications,
 * (4) returns a typed OpsActionResult.
 *
 * Honesty:
 *  - resendNotification records the *intent* to resend. We do NOT actually send
 *    an email here (no real delivery pipeline is wired in v1, and Ops never
 *    sends real mail). The returned message says so plainly.
 *  - markReviewed flags an operator's review of a notification in the audit trail
 *    (the underlying Notification.read flag is the customer's own state and is
 *    left untouched — an operator reviewing it is not the customer reading it).
 *  - disableTemplate is a feature-flag-style kill switch for a noisy template,
 *    persisted in SystemSetting "notifications.disabled.<type>". It does not
 *    delete anything; it records the operator's decision for the worker to honor.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOpsPermission } from "@/lib/ops/guard";
import { recordAdminAudit } from "@/lib/ops/audit";
import type { OpsActionResult } from "@/lib/ops/types";

const NOTIFICATION_TYPES = [
  "price_dropped",
  "target_reached",
  "back_in_stock",
  "out_of_stock",
  "price_increased",
  "cart_reminder",
  "checkout_incomplete",
  "weekly_review",
] as const;

type NotificationType = (typeof NOTIFICATION_TYPES)[number];

function isType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

/**
 * Record the intent to resend a notification. Permission: notifications.resend.
 * v1 does not actually send anything (no real delivery pipeline; Ops never sends
 * real mail) — this writes the audit row and returns an honest message.
 */
export async function resendNotification(id: string): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("notifications.resend");
  if (!gate.ok) return gate;
  // The success branch of requireOpsPermission carries the viewer; the union with
  // OpsActionResult<never> means TS can't auto-narrow, so capture it explicitly.
  const viewer = ("viewer" in gate ? gate.viewer : null)!;
  try {
    const notif = await prisma.notification.findUnique({
      where: { id },
      select: { id: true, type: true, userId: true, productId: true },
    });
    if (!notif) {
      return { ok: false, reason: "not-found", message: "Notification not found." };
    }

    await recordAdminAudit({
      actor: viewer,
      action: "notification.resend",
      targetType: "notification",
      targetId: notif.id,
      targetUserId: notif.userId,
      metadata: { type: notif.type, productId: notif.productId, delivered: false },
    });

    revalidatePath("/ops/notifications");
    return {
      ok: true,
      message: "Resend recorded. No email is sent from Ops in this version.",
    };
  } catch (e) {
    console.error("[ops] resendNotification failed:", e);
    return { ok: false, reason: "error" };
  }
}

/**
 * Mark a notification as reviewed by an operator. Permission: notifications.resend.
 * This records the review in the audit trail only — it deliberately leaves the
 * customer-owned `read` flag untouched (an operator reviewing is not the customer
 * reading).
 */
export async function markReviewed(id: string): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("notifications.resend");
  if (!gate.ok) return gate;
  const viewer = ("viewer" in gate ? gate.viewer : null)!;
  try {
    const notif = await prisma.notification.findUnique({
      where: { id },
      select: { id: true, type: true, userId: true },
    });
    if (!notif) {
      return { ok: false, reason: "not-found", message: "Notification not found." };
    }

    await recordAdminAudit({
      actor: viewer,
      action: "notification.reviewed",
      targetType: "notification",
      targetId: notif.id,
      targetUserId: notif.userId,
      metadata: { type: notif.type },
    });

    revalidatePath("/ops/notifications");
    return { ok: true, message: "Marked as reviewed." };
  } catch (e) {
    console.error("[ops] markReviewed failed:", e);
    return { ok: false, reason: "error" };
  }
}

/**
 * Turn a notification template on or off (a feature-flag-style kill switch for a
 * noisy template). Permission: notifications.mutate. Persisted in SystemSetting
 * "notifications.disabled.<type>" (valueJson = true | false) for the worker to
 * honor. Records the before/after in the audit log. Destructive-ish, so the UI
 * collects a reason.
 */
export async function disableTemplate(
  type: string,
  disabled: boolean,
  reason: string,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("notifications.mutate");
  if (!gate.ok) return gate;
  const viewer = ("viewer" in gate ? gate.viewer : null)!;
  if (!isType(type)) {
    return { ok: false, reason: "invalid", message: "Unknown notification type." };
  }
  try {
    const key = "notifications.disabled." + type;
    const existing = await prisma.systemSetting.findUnique({
      where: { key },
      select: { valueJson: true },
    });

    let before = false;
    if (existing?.valueJson) {
      try {
        before = JSON.parse(existing.valueJson) === true;
      } catch {
        before = false;
      }
    }

    const valueJson = JSON.stringify(disabled);
    await prisma.systemSetting.upsert({
      where: { key },
      create: {
        key,
        valueJson,
        category: "notifications",
        description:
          "Kill switch for the " + type + " notification template (true = paused).",
        updatedById: viewer.id,
      },
      update: { valueJson, category: "notifications", updatedById: viewer.id },
    });

    await recordAdminAudit({
      actor: viewer,
      action: disabled ? "notification.template.disable" : "notification.template.enable",
      targetType: "notification_template",
      targetId: type,
      reason,
      before: { disabled: before },
      after: { disabled },
    });

    revalidatePath("/ops/notifications");
    return {
      ok: true,
      message: disabled ? "Template paused." : "Template resumed.",
    };
  } catch (e) {
    console.error("[ops] disableTemplate failed:", e);
    return { ok: false, reason: "error" };
  }
}
