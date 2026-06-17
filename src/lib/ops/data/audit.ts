/**
 * UniKart Ops — audit log read access (shared by the Audit page + detail pages).
 */
import { hasDatabase, prisma } from "../../db";
import type { AuditLogView, Paginated } from "../types";

type AuditRow = {
  id: string;
  adminUserId: string;
  adminEmail: string;
  role: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetUserId: string | null;
  reason: string | null;
  beforeJson: string | null;
  afterJson: string | null;
  metadataJson: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

export function mapAudit(r: AuditRow): AuditLogView {
  return {
    id: r.id,
    adminUserId: r.adminUserId,
    adminEmail: r.adminEmail,
    role: r.role,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    targetUserId: r.targetUserId,
    reason: r.reason,
    beforeJson: r.beforeJson,
    afterJson: r.afterJson,
    metadataJson: r.metadataJson,
    ipAddress: r.ipAddress,
    userAgent: r.userAgent,
    createdAt: r.createdAt.toISOString(),
  };
}

export interface AuditFilter {
  q?: string;
  action?: string;
  targetType?: string;
  adminUserId?: string;
  targetUserId?: string;
  page?: number;
  pageSize?: number;
}

/** Paginated, filtered audit search (newest first). */
export async function getAuditLogs(filter: AuditFilter = {}): Promise<Paginated<AuditLogView>> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filter.pageSize ?? 25));
  const empty: Paginated<AuditLogView> = { rows: [], total: 0, page, pageSize };
  if (!hasDatabase()) return empty;

  const where: Record<string, unknown> = {};
  if (filter.action) where.action = filter.action;
  if (filter.targetType) where.targetType = filter.targetType;
  if (filter.adminUserId) where.adminUserId = filter.adminUserId;
  if (filter.targetUserId) where.targetUserId = filter.targetUserId;
  if (filter.q) {
    where.OR = [
      { adminEmail: { contains: filter.q, mode: "insensitive" } },
      { action: { contains: filter.q, mode: "insensitive" } },
      { targetId: { contains: filter.q } },
      { reason: { contains: filter.q, mode: "insensitive" } },
    ];
  }

  try {
    const [rows, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.adminAuditLog.count({ where }),
    ]);
    return { rows: rows.map(mapAudit), total, page, pageSize };
  } catch (e) {
    console.error("[ops] getAuditLogs:", e);
    return empty;
  }
}

/** Recent audit entries touching a specific target (e.g. a user or product). */
export async function getAuditForTarget(
  targetType: string,
  targetId: string,
  limit = 10,
): Promise<AuditLogView[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await prisma.adminAuditLog.findMany({
      where: { targetType, targetId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(mapAudit);
  } catch (e) {
    console.error("[ops] getAuditForTarget:", e);
    return [];
  }
}

/** Recent audit entries involving a user (as target). */
export async function getAuditForUser(userId: string, limit = 10): Promise<AuditLogView[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await prisma.adminAuditLog.findMany({
      where: { targetUserId: userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return rows.map(mapAudit);
  } catch (e) {
    console.error("[ops] getAuditForUser:", e);
    return [];
  }
}

/** Distinct action + targetType values for filter dropdowns. */
export async function getAuditFacets(): Promise<{ actions: string[]; targetTypes: string[] }> {
  if (!hasDatabase()) return { actions: [], targetTypes: [] };
  try {
    const [actions, targetTypes] = await Promise.all([
      prisma.adminAuditLog.findMany({ distinct: ["action"], select: { action: true }, take: 100 }),
      prisma.adminAuditLog.findMany({ distinct: ["targetType"], select: { targetType: true }, take: 50 }),
    ]);
    return {
      actions: actions.map((a) => a.action).sort(),
      targetTypes: targetTypes.map((t) => t.targetType).sort(),
    };
  } catch {
    return { actions: [], targetTypes: [] };
  }
}
