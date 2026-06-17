"use server";

/**
 * UniKart Ops — Users server actions.
 *
 * Every mutation here:
 *   1. Gates via requireOpsPermission (defence in depth — the layout already
 *      gates, but server functions must authorize themselves).
 *   2. Writes an immutable audit row via recordAdminAudit (actor = gate.viewer).
 *   3. revalidatePath so the affected pages re-render.
 *   4. Returns a typed OpsActionResult.
 *
 * Privacy: data export + deletion controls are always available regardless of
 * plan (brand non-negotiable). Deletion only QUEUES a DataRequest — it never
 * deletes here. No secrets/tokens/cards are ever read or written.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOpsPermission } from "@/lib/ops/guard";
import { recordAdminAudit } from "@/lib/ops/audit";
import { isRole, type Role } from "@/lib/ops/permissions";
import type { OpsActionResult } from "@/lib/ops/types";

function revalidateUser(userId: string): void {
  revalidatePath("/ops/users");
  revalidatePath("/ops/users/" + userId);
}

/** Add an internal support note attached directly to a user. */
export async function addSupportNote(
  userId: string,
  body: string,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("users.note");
  if (!gate.ok) return gate;

  const trimmed = body.trim();
  if (trimmed.length < 1) {
    return { ok: false, reason: "invalid", message: "Add a note before saving." };
  }

  try {
    const note = await prisma.supportNote.create({
      data: {
        userId,
        adminUserId: gate.viewer.id,
        body: trimmed.slice(0, 5000),
        visibility: "internal",
      },
      select: { id: true },
    });
    await recordAdminAudit({
      actor: gate.viewer,
      action: "user.note.add",
      targetType: "user",
      targetId: userId,
      targetUserId: userId,
      after: { noteId: note.id, visibility: "internal" },
    });
    revalidateUser(userId);
    return { ok: true, message: "Note added." };
  } catch (e) {
    console.error("[ops] addSupportNote:", e);
    return { ok: false, reason: "error" };
  }
}

/**
 * Change a user's Ops role. OWNER is protected: only an OWNER may grant or
 * remove the OWNER role (defence in depth — also reflected in the UI).
 */
export async function changeRole(
  userId: string,
  role: string,
  reason: string,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("users.role");
  if (!gate.ok) return gate;

  if (!isRole(role)) {
    return { ok: false, reason: "invalid", message: "That isn't a valid role." };
  }
  const nextRole: Role = role;

  try {
    const before = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (!before) return { ok: false, reason: "not-found", message: "User not found." };

    // OWNER guard: only an OWNER may grant OR remove OWNER.
    const grantingOwner = nextRole === "OWNER";
    const removingOwner = before.role === "OWNER" && nextRole !== "OWNER";
    if ((grantingOwner || removingOwner) && gate.viewer.role !== "OWNER") {
      return {
        ok: false,
        reason: "forbidden",
        message: "Only an Owner can grant or remove the Owner role.",
      };
    }

    if (before.role === nextRole) {
      return { ok: true, message: "Role unchanged." };
    }

    await prisma.user.update({ where: { id: userId }, data: { role: nextRole } });
    await recordAdminAudit({
      actor: gate.viewer,
      action: "user.role.change",
      targetType: "user",
      targetId: userId,
      targetUserId: userId,
      reason,
      before: { role: before.role },
      after: { role: nextRole },
    });
    revalidateUser(userId);
    return { ok: true, message: "Role updated." };
  } catch (e) {
    console.error("[ops] changeRole:", e);
    return { ok: false, reason: "error" };
  }
}

/** Disable a user's account (blocks the customer app at its layout gate). */
export async function disableUser(
  userId: string,
  reason: string,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("users.disable");
  if (!gate.ok) return gate;

  try {
    const before = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true, role: true },
    });
    if (!before) return { ok: false, reason: "not-found", message: "User not found." };

    // Don't let a non-owner disable an Owner account.
    if (before.role === "OWNER" && gate.viewer.role !== "OWNER") {
      return {
        ok: false,
        reason: "forbidden",
        message: "Only an Owner can disable an Owner account.",
      };
    }
    if (before.status === "disabled") {
      return { ok: true, message: "Account is already disabled." };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { status: "disabled", disabledAt: new Date() },
    });
    await recordAdminAudit({
      actor: gate.viewer,
      action: "user.disable",
      targetType: "user",
      targetId: userId,
      targetUserId: userId,
      reason,
      before: { status: before.status },
      after: { status: "disabled" },
    });
    revalidateUser(userId);
    return { ok: true, message: "Account disabled." };
  } catch (e) {
    console.error("[ops] disableUser:", e);
    return { ok: false, reason: "error" };
  }
}

/** Re-enable a previously disabled account. */
export async function enableUser(
  userId: string,
  reason: string,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("users.disable");
  if (!gate.ok) return gate;

  try {
    const before = await prisma.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });
    if (!before) return { ok: false, reason: "not-found", message: "User not found." };
    if (before.status === "active") {
      return { ok: true, message: "Account is already active." };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { status: "active", disabledAt: null },
    });
    await recordAdminAudit({
      actor: gate.viewer,
      action: "user.enable",
      targetType: "user",
      targetId: userId,
      targetUserId: userId,
      reason,
      before: { status: before.status },
      after: { status: "active" },
    });
    revalidateUser(userId);
    return { ok: true, message: "Account re-enabled." };
  } catch (e) {
    console.error("[ops] enableUser:", e);
    return { ok: false, reason: "error" };
  }
}

/** Reset onboarding so the user sees the first-run flow again. */
export async function resetOnboarding(userId: string): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("users.mutate");
  if (!gate.ok) return gate;

  try {
    const before = await prisma.user.findUnique({
      where: { id: userId },
      select: { onboardingCompletedAt: true },
    });
    if (!before) return { ok: false, reason: "not-found", message: "User not found." };

    await prisma.user.update({
      where: { id: userId },
      data: { onboardingCompletedAt: null },
    });
    await recordAdminAudit({
      actor: gate.viewer,
      action: "user.onboarding.reset",
      targetType: "user",
      targetId: userId,
      targetUserId: userId,
      before: {
        onboardingCompletedAt: before.onboardingCompletedAt
          ? before.onboardingCompletedAt.toISOString()
          : null,
      },
      after: { onboardingCompletedAt: null },
    });
    revalidateUser(userId);
    return { ok: true, message: "Onboarding reset." };
  } catch (e) {
    console.error("[ops] resetOnboarding:", e);
    return { ok: false, reason: "error" };
  }
}

/**
 * Queue a data export request (privacy). Always available regardless of plan.
 * The export itself is fulfilled by the privacy pipeline, not here.
 */
export async function requestDataExport(userId: string): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("users.mutate");
  if (!gate.ok) return gate;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return { ok: false, reason: "not-found", message: "User not found." };

    const req = await prisma.dataRequest.create({
      data: { userId, type: "export", status: "pending", requestedById: gate.viewer.id },
      select: { id: true },
    });
    await recordAdminAudit({
      actor: gate.viewer,
      action: "user.data.export.request",
      targetType: "data_request",
      targetId: req.id,
      targetUserId: userId,
      after: { type: "export", status: "pending" },
    });
    revalidateUser(userId);
    return { ok: true, message: "Data export queued." };
  } catch (e) {
    console.error("[ops] requestDataExport:", e);
    return { ok: false, reason: "error" };
  }
}

/**
 * Queue a data deletion request (privacy). Always available regardless of plan.
 * This does NOT delete anything — it records a pending request for the privacy
 * pipeline to action.
 */
export async function queueDataDeletion(
  userId: string,
  reason: string,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("users.mutate");
  if (!gate.ok) return gate;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) return { ok: false, reason: "not-found", message: "User not found." };

    const req = await prisma.dataRequest.create({
      data: {
        userId,
        type: "delete",
        status: "pending",
        requestedById: gate.viewer.id,
        reason: reason ? reason.slice(0, 1000) : null,
      },
      select: { id: true },
    });
    await recordAdminAudit({
      actor: gate.viewer,
      action: "user.data.deletion.queue",
      targetType: "data_request",
      targetId: req.id,
      targetUserId: userId,
      reason,
      after: { type: "delete", status: "pending" },
    });
    revalidateUser(userId);
    return { ok: true, message: "Deletion queued. No data has been removed yet." };
  } catch (e) {
    console.error("[ops] queueDataDeletion:", e);
    return { ok: false, reason: "error" };
  }
}

/** Mark/unmark a user as a test account (excluded from metrics, never billed). */
export async function setTestAccount(
  userId: string,
  value: boolean,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("users.mutate");
  if (!gate.ok) return gate;

  try {
    const before = await prisma.user.findUnique({
      where: { id: userId },
      select: { isTestAccount: true },
    });
    if (!before) return { ok: false, reason: "not-found", message: "User not found." };

    await prisma.user.update({ where: { id: userId }, data: { isTestAccount: value } });
    await recordAdminAudit({
      actor: gate.viewer,
      action: "user.flag.test",
      targetType: "user",
      targetId: userId,
      targetUserId: userId,
      before: { isTestAccount: before.isTestAccount },
      after: { isTestAccount: value },
    });
    revalidateUser(userId);
    return { ok: true, message: value ? "Marked as a test account." : "Test flag cleared." };
  } catch (e) {
    console.error("[ops] setTestAccount:", e);
    return { ok: false, reason: "error" };
  }
}

/** Mark/unmark a user as internal (UniKart team — excluded from metrics). */
export async function setInternal(
  userId: string,
  value: boolean,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("users.mutate");
  if (!gate.ok) return gate;

  try {
    const before = await prisma.user.findUnique({
      where: { id: userId },
      select: { isInternal: true },
    });
    if (!before) return { ok: false, reason: "not-found", message: "User not found." };

    await prisma.user.update({ where: { id: userId }, data: { isInternal: value } });
    await recordAdminAudit({
      actor: gate.viewer,
      action: "user.flag.internal",
      targetType: "user",
      targetId: userId,
      targetUserId: userId,
      before: { isInternal: before.isInternal },
      after: { isInternal: value },
    });
    revalidateUser(userId);
    return { ok: true, message: value ? "Marked as internal." : "Internal flag cleared." };
  } catch (e) {
    console.error("[ops] setInternal:", e);
    return { ok: false, reason: "error" };
  }
}
