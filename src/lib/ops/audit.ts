/**
 * UniKart Ops — admin audit log.
 *
 * `recordAdminAudit()` writes one immutable AdminAuditLog row for every
 * sensitive admin mutation (and notable reads). It captures the actor, the
 * before/after snapshots, a sanitized metadata blob, and the request IP / UA.
 *
 * Best-effort: it never throws into the caller (an audit write failing must not
 * break the underlying action), but failures are logged loudly server-side.
 */
import { hasDatabase, prisma } from "../db";
import { getRequestContext } from "./request-context";
import { safeJson } from "./sanitize";
import type { Role } from "./permissions";

export interface AuditActor {
  id: string;
  email: string;
  role: Role | string;
}

export interface AuditInput {
  actor: AuditActor;
  /** Stable verb, e.g. "user.role.change", "feature_flag.toggle", "data.export". */
  action: string;
  /** "user" | "product" | "feature_flag" | "system" | "support_ticket" | … */
  targetType: string;
  targetId?: string | null;
  targetUserId?: string | null;
  reason?: string | null;
  before?: Record<string, unknown> | string | null;
  after?: Record<string, unknown> | string | null;
  metadata?: Record<string, unknown> | null;
}

function toJsonColumn(
  value: Record<string, unknown> | string | null | undefined,
): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return safeJson(value);
}

/**
 * Append one audit row. Returns the created row id (or null on failure / no DB).
 * Callers should `await` this but must not depend on its success for correctness.
 */
export async function recordAdminAudit(input: AuditInput): Promise<string | null> {
  if (!hasDatabase()) return null;
  try {
    const ctx = await getRequestContext();
    const row = await prisma.adminAuditLog.create({
      data: {
        adminUserId: input.actor.id,
        adminEmail: input.actor.email,
        role: String(input.actor.role),
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        targetUserId: input.targetUserId ?? null,
        reason: input.reason?.slice(0, 1000) ?? null,
        beforeJson: toJsonColumn(input.before),
        afterJson: toJsonColumn(input.after),
        metadataJson: toJsonColumn(input.metadata),
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent?.slice(0, 500) ?? null,
      },
      select: { id: true },
    });
    return row.id;
  } catch (e) {
    console.error("[ops] recordAdminAudit failed:", e);
    return null;
  }
}

/**
 * Record a denied / unauthorized access attempt. Used by the Ops gate when an
 * authenticated but unauthorized user reaches Ops, and by guards on forbidden
 * mutations.
 */
export async function recordAccessDenied(
  actor: AuditActor,
  attempted: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await recordAdminAudit({
    actor,
    action: "access.denied",
    targetType: "ops",
    targetId: attempted,
    metadata,
  });
}
