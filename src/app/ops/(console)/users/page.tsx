import { Download } from "lucide-react";
import { getOpsViewer } from "@/lib/ops/viewer";
import { can } from "@/lib/ops/permissions";
import { readListParams, makeSortHref, makePageHref } from "@/lib/ops/data/common";
import { getUsers, type UserRow } from "@/lib/ops/data/users";
import { shortDate, num } from "@/lib/ops/format";
import { OpsPageHeader } from "@/components/ops/OpsPageHeader";
import { OpsFilterBar } from "@/components/ops/OpsFilterBar";
import { OpsDataTable, type OpsColumn } from "@/components/ops/OpsDataTable";
import { OpsStatusPill } from "@/components/ops/OpsStatusPill";
import { OpsEmptyState } from "@/components/ops/OpsEmptyState";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { ROLES } from "@/lib/ops/permissions";

/**
 * Users — the people on UniKart. Server-driven search / filter / sort / paging
 * (never loads all rows into the browser). Calm, hairline table; rows link to
 * the per-user detail.
 */
export const dynamic = "force-dynamic";

const BASE = "/ops/users";
const PAGE_SIZE = 25;

function planLabel(plan: string): string {
  return plan === "pro" ? "UniKart Coast" : "Free";
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const viewer = await getOpsViewer();
  const canExport = can(viewer, "users.export");

  const lp = readListParams(sp, {
    defaultSort: { key: "createdAt", dir: "desc" },
    sortableKeys: ["createdAt", "lastActiveAt", "productCount"],
    pageSize: PAGE_SIZE,
  });

  const { rows, total } = await getUsers(lp);

  const columns: OpsColumn<UserRow>[] = [
    {
      key: "name",
      header: "Person",
      render: (u) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{u.name || "—"}</p>
          <p className="truncate text-xs text-slate">{u.email}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      render: (u) => <OpsStatusPill status={u.role.toLowerCase()} label={u.role} />,
    },
    {
      key: "plan",
      header: "Plan",
      render: (u) =>
        u.plan === "pro" ? (
          <Pill tone="accent">UniKart Coast</Pill>
        ) : (
          <Pill tone="neutral">Free</Pill>
        ),
    },
    {
      key: "createdAt",
      header: "Joined",
      sortable: true,
      align: "right",
      render: (u) => <span className="tabular-nums text-slate">{shortDate(u.createdAt)}</span>,
    },
    {
      key: "lastActiveAt",
      header: "Last active",
      sortable: true,
      align: "right",
      render: (u) => (
        <span className="tabular-nums text-slate">
          {u.lastActiveAt ? shortDate(u.lastActiveAt) : "—"}
        </span>
      ),
    },
    {
      key: "productCount",
      header: "Saved",
      sortable: true,
      align: "right",
      render: (u) => <span className="tabular-nums">{num(u.productCount)}</span>,
    },
    {
      key: "collectionCount",
      header: "Collections",
      align: "right",
      render: (u) => <span className="tabular-nums text-slate">{num(u.collectionCount)}</span>,
    },
    {
      key: "cartItemCount",
      header: "Cart",
      align: "right",
      render: (u) => <span className="tabular-nums text-slate">{num(u.cartItemCount)}</span>,
    },
    {
      key: "enabledAlertCount",
      header: "Alerts",
      align: "right",
      render: (u) => <span className="tabular-nums text-slate">{num(u.enabledAlertCount)}</span>,
    },
    {
      key: "status",
      header: "Account",
      render: (u) => <OpsStatusPill status={u.status} />,
    },
    {
      key: "openTicketCount",
      header: "Support",
      align: "right",
      render: (u) =>
        u.openTicketCount > 0 ? (
          <Pill tone="warn">{num(u.openTicketCount)} open</Pill>
        ) : (
          <span className="text-silver">—</span>
        ),
    },
  ];

  const exportHref = (() => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(lp.params)) {
      if (k === "page") continue;
      if (v) qs.set(k, v);
    }
    const s = qs.toString();
    return s ? `/api/ops/export/users?${s}` : "/api/ops/export/users";
  })();

  return (
    <>
      <OpsPageHeader
        title="Users"
        description="Everyone on UniKart — accounts, plans, and activity at a glance."
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
        searchPlaceholder="Search by name, email, or id"
        filters={[
          {
            key: "role",
            label: "Role",
            options: ROLES.map((r) => ({ value: r, label: r })),
          },
          {
            key: "plan",
            label: "Plan",
            options: [
              { value: "free", label: "Free" },
              { value: "pro", label: planLabel("pro") },
            ],
          },
          {
            key: "status",
            label: "Account",
            options: [
              { value: "active", label: "Active" },
              { value: "disabled", label: "Disabled" },
            ],
          },
        ]}
      />

      <OpsDataTable
        columns={columns}
        rows={rows}
        getRowKey={(u) => u.id}
        rowHref={(u) => `${BASE}/${u.id}`}
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
            title="No users match these filters"
            description="Try clearing the search or filters above."
          />
        }
      />
    </>
  );
}
