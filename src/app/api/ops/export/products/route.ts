import { assertOpsApi } from "@/lib/ops/guard";
import { recordAdminAudit } from "@/lib/ops/audit";
import { readListParams } from "@/lib/ops/data/common";
import { getProductsForExport } from "@/lib/ops/data/products";

/**
 * Products CSV export. Guarded by `products.export`; honours the same filters as
 * the list page (passed through the query string) so an operator exports exactly
 * what they're looking at. Every export is audited. Real DB rows only.
 */
export const dynamic = "force-dynamic";

const NOINDEX = { "X-Robots-Tag": "noindex, nofollow" };

/** RFC-4180 CSV field escaping. */
function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export async function GET(req: Request) {
  const gate = await assertOpsApi(req, "products.export");
  if ("response" in gate) return gate.response;

  // Build list params from the incoming query (search + filters + sort).
  const url = new URL(req.url);
  const sp: Record<string, string> = {};
  for (const [k, v] of url.searchParams.entries()) sp[k] = v;
  const lp = readListParams(sp, {
    defaultSort: { key: "createdAt", dir: "desc" },
    sortableKeys: ["createdAt", "currentPrice", "lastCheckedAt"],
  });

  const rows = await getProductsForExport(lp);

  const header = [
    "id",
    "title",
    "storeDomain",
    "userEmail",
    "currentPrice",
    "availability",
    "metadataConfidence",
    "lastCheckedAt",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.id),
        csvCell(r.title),
        csvCell(r.storeDomain),
        csvCell(r.userEmail),
        csvCell(r.currentPrice ?? ""),
        csvCell(r.availability),
        csvCell(r.metadataConfidence),
        csvCell(r.lastCheckedAt ?? ""),
      ].join(","),
    );
  }
  const csv = lines.join("\r\n");

  await recordAdminAudit({
    actor: { id: gate.viewer.id, email: gate.viewer.email, role: gate.viewer.role },
    action: "products.export",
    targetType: "product",
    metadata: {
      count: rows.length,
      filters: {
        q: lp.q || undefined,
        domain: lp.params.domain,
        confidence: lp.params.confidence,
        availability: lp.params.availability,
        status: lp.params.status,
        stale: lp.params.stale,
        failed: lp.params.failed,
        changed: lp.params.changed,
        cart: lp.params.cart,
      },
    },
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    status: 200,
    headers: {
      ...NOINDEX,
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="unikart-products-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
