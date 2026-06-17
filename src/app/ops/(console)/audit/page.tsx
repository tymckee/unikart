import Link from "next/link";
import { Download } from "lucide-react";
import { getOpsViewer } from "@/lib/ops/viewer";
import { can } from "@/lib/ops/permissions";
import { readListParams, makeSortHref, makePageHref } from "@/lib/ops/data/common";
import { getAuditLogs, getAuditFacets } from "@/lib/ops/data/audit";
import type { AuditLogView } from "@/lib/ops/types";
import { dateTime, shortId, truncate } from "@/lib/ops/format";
import { OpsPageHeader } from "@/components/ops/OpsPageHeader";
import { OpsFilterBar } from "@/components/ops/OpsFilterBar";
import { OpsDataTable, type OpsColumn } from "@/components/ops/OpsDataTable";
import { OpsEmptyState } from "@/components/ops/OpsEmptyState";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";

/**
 * Audit log — the immutable record of every sensitive admin action.
 *
 * Read-only by design: there are no mutations here and nothing on this page can
 * edit or delete a log row. Server-driven search / filter / paging (never loads
 * all rows into the browser). Search spans admin email, action, target id, and
 * reason; the action and target-type filters come from getAuditFacets().
 */
export const dynamic = "force-dynamic";

const BASE = "/ops/audit";
const PAGE_SIZE = 25;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const viewer = await getOpsViewer();
  const canExport = can(viewer, "audit.export");

  const lp = readListParams(sp, {
    defaultSort: { key: "createdAt", dir: "desc" },
    sortableKeys: ["createdAt"],
    pageSize: PAGE_SIZE,
  });

  const [{ rows, total }, facets] = await Promise.all([
    getAuditLogs({
      q: lp.q || undefined,
      action: lp.params.action || undefined,
      targetType: lp.params.targetType || undefined,
      page: lp.page,
      pageSize: lp.pageSize,
    }),
    getAuditFacets(),
  ]);

  const columns: OpsColumn<AuditLogView>[] = [
    {
      key: "createdAt",
      header: "When",
      sortable: true,
      render: (e) => (
        <span className="whitespace-nowrap tabular-nums text-slate">{dateTime(e.createdAt)}</span>
      ),
    },
    {
      key: "adminEmail",
      header: "Admin",
      render: (e) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{e.adminEmail || "—"}</p>
          <p className="truncate text-xs text-slate">{e.role}</p>
        </div>
      ),
    },
    {
      key: "action",
      header: "Action",
      render: (e) => <Pill tone="neutral">{e.action}</Pill>,
    },
    {
      key: "target",
      header: "Target",
      render: (e) => (
        <div className="min-w-0">
          <p className="truncate text-ink">{e.targetType}</p>
          {e.targetId ? (
            <p className="truncate font-mono text-xs text-slate">{shortId(e.targetId)}</p>
          ) : (
            <span className="text-xs text-silver">—</span>
          )}
        </div>
      ),
    },
    {
      key: "targetUserId",
      header: "User",
      action: true,
      render: (e) =>
        e.targetUserId ? (
          <Link
            href={"/ops/users/" + e.targetUserId}
            className="font-mono text-xs text-accent transition-colors hover:text-accent-ink"
          >
            {shortId(e.targetUserId)}
          </Link>
        ) : (
          <span className="text-silver">—</span>
        ),
    },
    {
      key: "ipAddress",
      header: "IP",
      render: (e) => (
        <span className="font-mono text-xs text-slate">{e.ipAddress || "—"}</span>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      render: (e) => (
        <span className="text-slate" title={e.reason ?? undefined}>
          {truncate(e.reason, 64)}
        </span>
      ),
    },
  ];

  const exportHref = (() => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(lp.params)) {
      if (k === "page" || k === "sort") continue;
      if (v) qs.set(k, v);
    }
    const s = qs.toString();
    return s ? "/api/ops/export/audit?" + s : "/api/ops/export/audit";
  })();

  return (
    <>
      <OpsPageHeader
        title="Audit log"
        description="An immutable, read-only record of every sensitive admin action. Entries can't be edited or removed."
        actions={
          canExport ? (
            <Button variant="secondary" size="sm" href={exportHref}>
              <Download size={15} />
              Export CSV
            </Button>
          ) : undefined
        }
      />

      <OpsFilterBar
        searchPlaceholder="Search by admin, action, target id, or reason"
        filters={[
          {
            key: "action",
            label: "Action",
            options: facets.actions.map((a) => ({ value: a, label: a })),
          },
          {
            key: "targetType",
            label: "Type",
            options: facets.targetTypes.map((t) => ({ value: t, label: t })),
          },
        ]}
      />

      <OpsDataTable
        columns={columns}
        rows={rows}
        getRowKey={(e) => e.id}
        sort={lp.sort ?? undefined}
        sortHref={(k) => makeSortHref(BASE, lp.params, lp.sort, k)}
        pagination={{
          page: lp.page,
          pageSize: lp.pageSize,
          total,
          hrefForPage: (p) => makePageHref(BASE, lp.params, p),
        }}
        empty={
          <OpsEmptyState
            title="No audit entries match these filters"
            description="Try clearing the search or filters above."
          />
        }
      />
    </>
  );
}
