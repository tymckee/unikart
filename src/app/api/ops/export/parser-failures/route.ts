/**
 * UniKart Ops — Parser failures CSV export.
 *
 * GET /api/ops/export/parser-failures
 *   Guarded by assertOpsApi(req, "parser.export"): host + auth + RBAC, with
 *   noindex headers. Streams a CSV of failed ParseAttempt rows so operators can
 *   triage which domains need adapters.
 *
 * Columns: createdAt, domain, errorCode, errorMessage, url.
 *
 * Reminders for whoever wires the real reparse pipeline (this route is read-only
 * and does none of it): do NOT bypass anti-bot protections, do NOT scrape
 * aggressively, and never store cookies, credentials, or full page bodies. We
 * read public product metadata only; errorMessage is already sanitized at write
 * time (recordParseAttempt), and we never export tokens or secrets.
 */
import { prisma, hasDatabase } from "@/lib/db";
import { assertOpsApi } from "@/lib/ops/guard";
import { recordAdminAudit } from "@/lib/ops/audit";

export const dynamic = "force-dynamic";

/** CSV-escape a single field (RFC 4180-ish): wrap in quotes, double inner quotes. */
function csvCell(value: string | null | undefined): string {
  const s = value == null ? "" : String(value);
  return '"' + s.replace(/"/g, '""') + '"';
}

export async function GET(req: Request) {
  const gate = await assertOpsApi(req, "parser.export");
  if ("response" in gate) return gate.response;

  const noindex = { "X-Robots-Tag": "noindex, nofollow" } as const;

  if (!hasDatabase()) {
    return new Response(JSON.stringify({ error: "Database unavailable" }), {
      status: 503,
      headers: { ...noindex, "content-type": "application/json" },
    });
  }

  try {
    const rows = await prisma.parseAttempt.findMany({
      where: { status: "failed" },
      orderBy: { createdAt: "desc" },
      take: 10000,
      select: {
        createdAt: true,
        domain: true,
        errorCode: true,
        errorMessage: true,
        url: true,
      },
    });

    const header = ["createdAt", "domain", "errorCode", "errorMessage", "url"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          csvCell(r.createdAt.toISOString()),
          csvCell(r.domain),
          csvCell(r.errorCode),
          csvCell(r.errorMessage),
          csvCell(r.url),
        ].join(","),
      );
    }
    const csv = lines.join("\r\n");

    await recordAdminAudit({
      actor: gate.viewer,
      action: "parser.export",
      targetType: "parse_attempt",
      targetId: "failures",
      metadata: { rows: rows.length, format: "csv" },
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      status: 200,
      headers: {
        ...noindex,
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": 'attachment; filename="unikart-parser-failures-' + stamp + '.csv"',
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("[ops] parser-failures export:", e);
    return new Response(JSON.stringify({ error: "Export failed" }), {
      status: 500,
      headers: { ...noindex, "content-type": "application/json" },
    });
  }
}
