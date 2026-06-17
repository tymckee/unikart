/**
 * UniKart Ops — Costs CSV export.
 *
 * GET /api/ops/export/costs → text/csv of the cost ledger. Gated by costs.export
 * (host + auth + permission via assertOpsApi), and every download writes an
 * audit row. Figures are estimates; the isEstimate column makes that explicit.
 */
import { assertOpsApi } from "@/lib/ops/guard";
import { recordAdminAudit } from "@/lib/ops/audit";
import { getCostLedgerForExport } from "@/lib/ops/data/costs";

export const dynamic = "force-dynamic";

/** RFC-4180-ish CSV cell: quote when needed, escape embedded quotes. */
function cell(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const HEADERS = [
  "occurredAt",
  "provider",
  "category",
  "operation",
  "quantity",
  "unit",
  "unitCostUsd",
  "estimatedCostUsd",
  "isEstimate",
] as const;

export async function GET(req: Request) {
  const gate = await assertOpsApi(req, "costs.export");
  if ("response" in gate) return gate.response;

  const rows = await getCostLedgerForExport();

  const lines = [HEADERS.join(",")];
  for (const r of rows) {
    lines.push(
      [
        cell(r.occurredAt.toISOString()),
        cell(r.provider),
        cell(r.category),
        cell(r.operation),
        cell(r.quantity),
        cell(r.unit),
        cell(r.unitCostUsd),
        cell(r.estimatedCostUsd),
        cell(r.isEstimate),
      ].join(","),
    );
  }
  // Trailing newline for POSIX-friendly files.
  const csv = lines.join("\r\n") + "\r\n";

  await recordAdminAudit({
    actor: { id: gate.viewer.id, email: gate.viewer.email, role: gate.viewer.role },
    action: "costs.export",
    targetType: "cost_ledger",
    metadata: { rows: rows.length, format: "csv" },
  });

  const filename =
    "unikart-costs-" + new Date().toISOString().slice(0, 10) + ".csv";

  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="' + filename + '"',
      "cache-control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
