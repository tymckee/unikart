import Link from "next/link";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";
import { OpsEmptyState } from "./OpsEmptyState";

export interface OpsColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  /** Don't wrap this cell in the row link (use for action buttons/menus). */
  action?: boolean;
  className?: string;
  headerClassName?: string;
  render: (row: T) => React.ReactNode;
}

export interface OpsPaginationConfig {
  page: number;
  pageSize: number;
  total: number;
  /** Build the href for a given 1-based page (preserves filters). */
  hrefForPage: (page: number) => string;
}

export interface OpsDataTableProps<T> {
  columns: OpsColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  /** Make rows navigate to a detail page. */
  rowHref?: (row: T) => string;
  /** Current sort, drives the header chevrons. */
  sort?: { key: string; dir: "asc" | "desc" };
  /** Build the href to toggle/apply sort on a column (server-driven). */
  sortHref?: (key: string) => string;
  pagination?: OpsPaginationConfig;
  empty?: React.ReactNode;
  className?: string;
}

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

/**
 * Server-rendered, server-driven data table. Sorting and pagination are URL
 * links (no client JS, no loading all rows into the browser). Rows can link to
 * a detail page. Calm hairline styling.
 */
export function OpsDataTable<T>({
  columns,
  rows,
  getRowKey,
  rowHref,
  sort,
  sortHref,
  pagination,
  empty,
  className,
}: OpsDataTableProps<T>) {
  if (rows.length === 0) {
    return <>{empty ?? <OpsEmptyState description="No records match these filters." />}</>;
  }

  return (
    <GlassCard className={cn("overflow-hidden", className)}>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              {columns.map((col) => {
                const isSorted = sort?.key === col.key;
                const content = (
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable &&
                      (isSorted ? (
                        sort?.dir === "asc" ? (
                          <ChevronUp size={13} />
                        ) : (
                          <ChevronDown size={13} />
                        )
                      ) : (
                        <ChevronsUpDown size={13} className="text-titanium" />
                      ))}
                  </span>
                );
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "whitespace-nowrap px-4 py-2.5 text-xs font-medium text-slate",
                      alignClass[col.align ?? "left"],
                      col.headerClassName,
                    )}
                  >
                    {col.sortable && sortHref ? (
                      <Link
                        href={sortHref(col.key)}
                        className="inline-flex items-center gap-1 rounded transition-colors hover:text-ink"
                      >
                        {content}
                      </Link>
                    ) : (
                      content
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const key = getRowKey(row);
              const href = rowHref?.(row);
              return (
                <tr
                  key={key}
                  className="border-b border-line/70 transition-colors last:border-0 hover:bg-canvas/60"
                >
                  {columns.map((col) => {
                    const cell = col.render(row);
                    const wrap = href && !col.action;
                    return (
                      <td
                        key={col.key}
                        className={cn(
                          "px-4 py-3 align-middle text-ink",
                          alignClass[col.align ?? "left"],
                          col.className,
                        )}
                      >
                        {wrap ? (
                          <Link href={href} className="block tap-highlight-none">
                            {cell}
                          </Link>
                        ) : (
                          cell
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pagination && <OpsPagination {...pagination} />}
    </GlassCard>
  );
}

/** Page x of y with prev/next links and a row range. */
export function OpsPagination({
  page,
  pageSize,
  total,
  hrefForPage,
}: OpsPaginationConfig) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const hasPrev = page > 1;
  const hasNext = page < pages;

  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-slate">
      <span className="tabular-nums">
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </span>
      <div className="flex items-center gap-1.5">
        <PagerLink href={hasPrev ? hrefForPage(page - 1) : undefined}>Previous</PagerLink>
        <span className="px-1 tabular-nums text-silver">
          {page} / {pages}
        </span>
        <PagerLink href={hasNext ? hrefForPage(page + 1) : undefined}>Next</PagerLink>
      </div>
    </div>
  );
}

function PagerLink({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) {
    return (
      <span className="cursor-not-allowed rounded-full border border-line px-3 py-1 text-silver opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-full border border-line px-3 py-1 text-ink transition-colors hover:bg-canvas"
    >
      {children}
    </Link>
  );
}
