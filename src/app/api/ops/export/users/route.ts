/**
 * UniKart Ops — Users CSV export.
 *
 * GET /api/ops/export/users (honors the same filters as the list page via the
 * query string). Guarded by assertOpsApi(..., "users.export"): off-host → 404,
 * unauthenticated → 401, wrong role → 403. On success it streams a CSV
 * attachment with noindex headers and records an audit row.
 *
 * Columns: id, name, email, role, plan, status, createdAt, lastActiveAt,
 * productCount. No secrets/tokens/cards (none exist in this schema).
 */
import { assertOpsApi } from "@/lib/ops/guard";
import { recordAdminAudit } from "@/lib/ops/audit";
import { readListParams } from "@/lib/ops/data/common";
import { getUsersForExport } from "@/lib/ops/data/users";

export const dynamic = "force-dynamic";

const NOINDEX = { "X-Robots-Tag": "noindex, nofollow" };

/** RFC-4180-safe CSV cell: quote and escape when needed. */
function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function planLabel(plan: string): string {
  return plan === "pro" ? "UniKart Coast" : "Free";
}

export async function GET(req: Request): Promise<Response> {
  const gate = await assertOpsApi(req, "users.export");
  if ("response" in gate) return gate.response;

  // Reuse the list-param reader so the export matches the on-screen filters.
  const url = new URL(req.url);
  const sp: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) sp[k] = v;

  const lp = readListParams(sp, {
    defaultSort: { key: "createdAt", dir: "desc" },
    sortableKeys: ["createdAt", "lastActiveAt", "productCount"],
    pageSize: 25,
  });

  let rows: Awaited<ReturnType<typeof getUsersForExport>>;
  try {
    rows = await getUsersForExport(lp);
  } catch (e) {
    console.error("[ops] users export:", e);
    return new Response(JSON.stringify({ error: "Export failed" }), {
      status: 500,
      headers: { ...NOINDEX, "content-type": "application/json" },
    });
  }

  const header = [
    "id",
    "name",
    "email",
    "role",
    "plan",
    "status",
    "createdAt",
    "lastActiveAt",
    "productCount",
  ];

  const lines = [header.join(",")];
  for (const u of rows) {
    lines.push(
      [
        csvCell(u.id),
        csvCell(u.name),
        csvCell(u.email),
        csvCell(u.role),
        csvCell(planLabel(u.plan)),
        csvCell(u.status),
        csvCell(u.createdAt),
        csvCell(u.lastActiveAt ?? ""),
        csvCell(u.productCount),
      ].join(","),
    );
  }
  const csv = lines.join("\r\n");

  // Audit the export (who, how many rows, which filters).
  await recordAdminAudit({
    actor: gate.viewer,
    action: "users.export",
    targetType: "user",
    metadata: {
      count: rows.length,
      filters: {
        q: lp.q || null,
        role: lp.params.role || null,
        plan: lp.params.plan || null,
        status: lp.params.status || null,
      },
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      ...NOINDEX,
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="unikart-users-' + stamp + '.csv"',
      "cache-control": "no-store",
    },
  });
}
