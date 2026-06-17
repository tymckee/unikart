import Link from "next/link";
import { Download, Package } from "lucide-react";
import { OpsPageHeader } from "@/components/ops/OpsPageHeader";
import { OpsFilterBar } from "@/components/ops/OpsFilterBar";
import { OpsDataTable, type OpsColumn } from "@/components/ops/OpsDataTable";
import { OpsStatusPill } from "@/components/ops/OpsStatusPill";
import { OpsEmptyState } from "@/components/ops/OpsEmptyState";
import { Pill } from "@/components/ui/Pill";
import { Button } from "@/components/ui/Button";
import { getOpsViewer } from "@/lib/ops/viewer";
import { can } from "@/lib/ops/permissions";
import { readListParams, makeSortHref, makePageHref } from "@/lib/ops/data/common";
import {
  getProducts,
  getTopProductDomains,
  type ProductListRow,
} from "@/lib/ops/data/products";
import { usd, shortDate, truncate } from "@/lib/ops/format";

/**
 * Products list — every saved item across all accounts, with server-driven
 * search / filter / sort / paginate. The numbers are real DB values; tracking
 * state is derived (one source of truth, shared with the detail page).
 */
export const dynamic = "force-dynamic";

const CONFIDENCE_TONE: Record<string, "down" | "warn" | "up" | "neutral"> = {
  high: "down",
  medium: "warn",
  low: "up",
};

const TRACKING_LABEL: Record<string, string> = {
  tracking: "Tracking",
  purchased: "Purchased",
  released: "Released",
  archived: "Archived",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const viewer = await getOpsViewer();
  const canExport = can(viewer, "products.export");

  const lp = readListParams(sp, {
    defaultSort: { key: "createdAt", dir: "desc" },
    sortableKeys: ["createdAt", "currentPrice", "lastCheckedAt"],
    pageSize: 25,
  });

  const [{ rows, total }, domains] = await Promise.all([
    getProducts(lp),
    getTopProductDomains(),
  ]);

  // Preserve the active filters/sort in the export href so the operator exports
  // exactly what they're looking at.
  const exportHref = (() => {
    const qs = new URLSearchParams(lp.params);
    qs.delete("page");
    const s = qs.toString();
    return s ? `/api/ops/export/products?${s}` : "/api/ops/export/products";
  })();

  const columns: OpsColumn<ProductListRow>[] = [
    {
      key: "title",
      header: "Product",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{truncate(r.title, 56)}</p>
          {r.brand && <p className="truncate text-xs text-slate">{r.brand}</p>}
        </div>
      ),
    },
    {
      key: "store",
      header: "Store",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate text-ink">{r.storeName}</p>
          <p className="truncate text-xs text-silver">{r.storeDomain}</p>
        </div>
      ),
    },
    {
      key: "userEmail",
      header: "Customer",
      render: (r) => <span className="text-slate">{truncate(r.userEmail, 28)}</span>,
    },
    {
      key: "currentPrice",
      header: "Price",
      align: "right",
      sortable: true,
      render: (r) => (
        <span className="tabular-nums text-ink">
          {r.currentPrice == null ? "—" : usd(r.currentPrice)}
        </span>
      ),
    },
    {
      key: "previousPrice",
      header: "Previous",
      align: "right",
      render: (r) => (
        <span className="tabular-nums text-silver">
          {r.previousPrice == null ? "—" : usd(r.previousPrice)}
        </span>
      ),
    },
    {
      key: "availability",
      header: "Stock",
      render: (r) => <OpsStatusPill status={r.availability} />,
    },
    {
      key: "metadataConfidence",
      header: "Confidence",
      render: (r) => (
        <Pill tone={CONFIDENCE_TONE[r.metadataConfidence] ?? "neutral"} className="capitalize">
          {r.metadataConfidence}
        </Pill>
      ),
    },
    {
      key: "lastCheckedAt",
      header: "Last checked",
      align: "right",
      sortable: true,
      render: (r) => (
        <span className="tabular-nums text-slate">
          {r.lastCheckedAt ? shortDate(r.lastCheckedAt) : "never"}
        </span>
      ),
    },
    {
      key: "trackingState",
      header: "Tracking",
      render: (r) => (
        <OpsStatusPill
          status={r.trackingState}
          label={TRACKING_LABEL[r.trackingState] ?? r.trackingState}
        />
      ),
    },
    {
      key: "collection",
      header: "Collection",
      render: (r) =>
        r.collectionName ? (
          <span className="text-slate">{truncate(r.collectionName, 22)}</span>
        ) : (
          <span className="text-silver">—</span>
        ),
    },
    {
      key: "cart",
      header: "Cart",
      render: (r) =>
        r.inActiveCart ? (
          <Pill tone="accent">In cart</Pill>
        ) : (
          <span className="text-silver">—</span>
        ),
    },
  ];

  return (
    <>
      <OpsPageHeader
        title="Products"
        description="Every saved item across all accounts — price, stock, parse confidence, and where it sits in someone's Hub."
        actions={
          canExport ? (
            <Button href={exportHref} variant="secondary" size="sm">
              <Download size={15} /> Export CSV
            </Button>
          ) : undefined
        }
      />

      <OpsFilterBar
        searchPlaceholder="Search title, brand, or store"
        filters={[
          ...(domains.length
            ? [{ key: "domain", label: "Store", options: domains }]
            : []),
          {
            key: "confidence",
            label: "Confidence",
            options: [
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ],
          },
          {
            key: "availability",
            label: "Stock",
            options: [
              { value: "in_stock", label: "In stock" },
              { value: "low_stock", label: "Low stock" },
              { value: "out_of_stock", label: "Out of stock" },
              { value: "preorder", label: "Preorder" },
              { value: "unknown", label: "Unknown" },
            ],
          },
          {
            key: "status",
            label: "Status",
            options: [
              { value: "active", label: "Active" },
              { value: "archived", label: "Archived" },
              { value: "released", label: "Released" },
              { value: "purchased", label: "Purchased" },
            ],
          },
          {
            key: "stale",
            label: "Stale (7d+)",
            options: [{ value: "yes", label: "Not checked in 7d" }],
          },
          {
            key: "failed",
            label: "Failed parse",
            options: [{ value: "yes", label: "Low confidence" }],
          },
          {
            key: "changed",
            label: "Price changed",
            options: [{ value: "yes", label: "Moved since last check" }],
          },
          {
            key: "cart",
            label: "In cart",
            options: [{ value: "yes", label: "In an active cart" }],
          },
        ]}
      />

      <OpsDataTable<ProductListRow>
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        rowHref={(r) => "/ops/products/" + r.id}
        sort={lp.sort ?? undefined}
        sortHref={(k) => makeSortHref("/ops/products", lp.params, lp.sort, k)}
        pagination={{
          page: lp.page,
          pageSize: lp.pageSize,
          total,
          hrefForPage: (p) => makePageHref("/ops/products", lp.params, p),
        }}
        empty={
          <OpsEmptyState
            icon={<Package size={20} />}
            title="No products match these filters"
            description="Try clearing a filter, or search by title, brand, or store."
            action={
              <Link
                href="/ops/products"
                className="text-sm text-accent-ink underline-offset-2 hover:underline"
              >
                Clear filters
              </Link>
            }
          />
        }
      />
    </>
  );
}
