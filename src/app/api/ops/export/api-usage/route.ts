/**
 * UniKart Ops — API Usage CSV export.
 *
 * GET /api/ops/export/api-usage
 *   - Gated by assertOpsApi(req, "apiUsage.export") (host + auth + RBAC).
 *   - Streams a CSV of recent APIUsageEvent rows (newest first, capped).
 *   - Writes one AdminAuditLog row ("apiUsage.export").
 *
 * PRIVACY: the export contains ONLY non-sensitive columns
 *   createdAt, route, method, statusCode, durationMs, provider, operation, estimatedCostUsd
 * It never includes request bodies, ipHash, user-agents, user ids, or any PII.
 */
import { assertOpsApi } from "@/lib/ops/guard";
import { recordAdminAudit } from "@/lib/ops/audit";
import { getApiUsageForExport } from "@/lib/ops/data/api-usage";

export const dynamic = "force-dynamic";

const HEADERS = [
  "createdAt",
  "route",
  "method",
  "statusCode",
  "durationMs",
  "provider",
  "operation",
  "estimatedCostUsd",
] as const;

/** RFC-4180-ish CSV cell escaping; null/undefined → empty cell. */
function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  const gate = await assertOpsApi(req, "apiUsage.export");
  if ("response" in gate) return gate.response;

  const rows = await getApiUsageForExport();

  const lines = [HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.createdAt),
        csvCell(r.route),
        csvCell(r.method),
        csvCell(r.statusCode),
        csvCell(r.durationMs),
        csvCell(r.provider),
        csvCell(r.operation),
        csvCell(r.estimatedCostUsd),
      ].join(","),
    );
  }
  const csv = lines.join("\r\n");

  await recordAdminAudit({
    actor: gate.viewer,
    action: "apiUsage.export",
    targetType: "api_usage",
    metadata: { rowCount: rows.length, format: "csv" },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="unikart-api-usage-${stamp}.csv"`,
      "cache-control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
