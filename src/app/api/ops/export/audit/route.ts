/**
 * UniKart Ops — Audit log CSV export.
 *
 * GET /api/ops/export/audit (honors the same search/filters as the list page via
 * the query string). Guarded by assertOpsApi(req, "audit.export"): off-host →
 * 404, unauthenticated → 401, wrong role → 403. Only OWNER/ADMIN hold
 * audit.export. On success it streams a CSV attachment with noindex headers and
 * records an audit row for the export itself (action "audit.export").
 *
 * Columns: createdAt, adminEmail, role, action, targetType, targetId,
 * targetUserId, ipAddress, reason. The audit log holds no secrets, tokens, or
 * payment-card data, so there is nothing sensitive to strip here.
 *
 * Read-only: this route never edits or deletes an audit row — it reads the same
 * rows the page shows (applying the live filters) and emits them, capped at
 * 10000 so a single request can't run unbounded.
 */
import { prisma, hasDatabase } from "@/lib/db";
import { assertOpsApi } from "@/lib/ops/guard";
import { recordAdminAudit } from "@/lib/ops/audit";

export const dynamic = "force-dynamic";

const NOINDEX = { "X-Robots-Tag": "noindex, nofollow" } as const;
const MAX_ROWS = 10000;

/** RFC-4180-safe CSV cell: quote and escape when needed. */
function csvCell(value: string | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export async function GET(req: Request): Promise<Response> {
  const gate = await assertOpsApi(req, "audit.export");
  if ("response" in gate) return gate.response;

  if (!hasDatabase()) {
    return new Response(JSON.stringify({ error: "Database unavailable" }), {
      status: 503,
      headers: { ...NOINDEX, "content-type": "application/json" },
    });
  }

  // Mirror the list page's filters so the export matches what the operator sees.
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const action = url.searchParams.get("action") ?? "";
  const targetType = url.searchParams.get("targetType") ?? "";

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;
  if (q) {
    where.OR = [
      { adminEmail: { contains: q, mode: "insensitive" } },
      { action: { contains: q, mode: "insensitive" } },
      { targetId: { contains: q } },
      { reason: { contains: q, mode: "insensitive" } },
    ];
  }

  try {
    const rows = await prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
      select: {
        createdAt: true,
        adminEmail: true,
        role: true,
        action: true,
        targetType: true,
        targetId: true,
        targetUserId: true,
        ipAddress: true,
        reason: true,
      },
    });

    const header = [
      "createdAt",
      "adminEmail",
      "role",
      "action",
      "targetType",
      "targetId",
      "targetUserId",
      "ipAddress",
      "reason",
    ];

    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          csvCell(r.createdAt.toISOString()),
          csvCell(r.adminEmail),
          csvCell(r.role),
          csvCell(r.action),
          csvCell(r.targetType),
          csvCell(r.targetId),
          csvCell(r.targetUserId),
          csvCell(r.ipAddress),
          csvCell(r.reason),
        ].join(","),
      );
    }
    const csv = lines.join("\r\n");

    // Audit the export itself (who, how many rows, which filters).
    await recordAdminAudit({
      actor: gate.viewer,
      action: "audit.export",
      targetType: "audit_log",
      metadata: {
        count: rows.length,
        format: "csv",
        filters: {
          q: q || null,
          action: action || null,
          targetType: targetType || null,
        },
      },
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      status: 200,
      headers: {
        ...NOINDEX,
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="unikart-audit-' + stamp + '.csv"',
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("[ops] audit export:", e);
    return new Response(JSON.stringify({ error: "Export failed" }), {
      status: 500,
      headers: { ...NOINDEX, "content-type": "application/json" },
    });
  }
}
