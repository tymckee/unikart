import Link from "next/link";
import { LifeBuoy, Users, Mail, Copy } from "lucide-react";
import { OpsPageHeader, OpsSection } from "@/components/ops/OpsPageHeader";
import { OpsMetricCard } from "@/components/ops/OpsMetricCard";
import { OpsFilterBar } from "@/components/ops/OpsFilterBar";
import { OpsDataTable, type OpsColumn } from "@/components/ops/OpsDataTable";
import { OpsStatusPill } from "@/components/ops/OpsStatusPill";
import { GlassCard } from "@/components/ui/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { getOpsViewer } from "@/lib/ops/viewer";
import { can } from "@/lib/ops/permissions";
import {
  readListParams,
  makeSortHref,
  makePageHref,
} from "@/lib/ops/data/common";
import {
  getTickets,
  getSupportStats,
  categoryLabel,
  type TicketRow,
} from "@/lib/ops/data/support";
import { createTicket } from "@/lib/ops/actions/support";
import { NewTicketButton } from "@/components/ops/support/NewTicketButton";
import { num, shortDate, truncate } from "@/lib/ops/format";

/**
 * Support workspace — a calm, lightweight console over SupportTicket. Metric
 * cards summarise the queue; the table is server-driven (filter/sort/paginate
 * via the URL). All counts are real DB reads.
 */
export const dynamic = "force-dynamic";

const PRIORITY_TONE: Record<string, "neutral" | "accent" | "warn" | "up"> = {
  low: "neutral",
  normal: "accent",
  high: "warn",
  urgent: "up",
};

/** Static canned responses — display-only macros to keep replies consistent. */
const MACROS: { title: string; body: string }[] = [
  {
    title: "Couldn't read a page",
    body: "Thanks for flagging this. Some stores block automated reading, so we couldn't pull the details for that link. You can still save it and add the price by hand, and we'll keep watching from there.",
  },
  {
    title: "How price tracking works",
    body: "We check tracked items on a regular schedule and record each price we see. When the price moves, you'll get a quiet heads-up. The Signal is based on tracked price history and isn't financial advice.",
  },
  {
    title: "Billing — UniKart Coast",
    body: "UniKart Coast renews automatically at the listed price, and you can cancel anytime from Settings. Cancelling stops the next renewal and keeps your access through the end of the current period.",
  },
  {
    title: "Privacy — export or delete",
    body: "You can export your data or delete your account anytime from Settings, at no cost. If you'd like us to start either for you, just confirm and we'll queue it.",
  },
];

export default async function SupportListPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const viewer = await getOpsViewer();
  const canWrite = can(viewer, "support.write");

  const lp = readListParams(sp, {
    defaultSort: { key: "createdAt", dir: "desc" },
    sortableKeys: ["createdAt", "status", "priority"],
    pageSize: 25,
  });

  const [{ rows, total }, stats] = await Promise.all([
    getTickets(lp),
    getSupportStats(),
  ]);

  const columns: OpsColumn<TicketRow>[] = [
    {
      key: "subject",
      header: "Subject",
      render: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{truncate(r.subject, 64)}</p>
          <p className="truncate text-xs text-slate">{r.email}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (r) => <OpsStatusPill status={r.status} />,
    },
    {
      key: "priority",
      header: "Priority",
      sortable: true,
      render: (r) => (
        <Pill tone={PRIORITY_TONE[r.priority] ?? "neutral"} className="capitalize">
          {r.priority}
        </Pill>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (r) => <span className="text-sm text-slate">{categoryLabel(r.category)}</span>,
    },
    {
      key: "assignedTo",
      header: "Assigned",
      render: (r) =>
        r.assignedToName ? (
          <span className="text-sm text-ink">{r.assignedToName}</span>
        ) : (
          <span className="text-sm text-silver">Unassigned</span>
        ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      align: "right",
      render: (r) => (
        <span className="tabular-nums text-sm text-slate">{shortDate(r.createdAt)}</span>
      ),
    },
  ];

  return (
    <>
      <OpsPageHeader
        title="Support"
        description="A calm queue over support tickets. Notes are internal; customer email replies are manual for now."
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/ops/users"
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-4 text-[0.8125rem] font-medium text-ink shadow-soft transition-colors hover:bg-canvas"
            >
              <Users size={15} /> User lookup
            </Link>
            {canWrite && <NewTicketButton createTicket={createTicket} />}
          </div>
        }
      />

      {/* Queue summary — real counts */}
      <OpsSection title="Queue" description="Open work, by status.">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <OpsMetricCard
            label="Open"
            value={num(stats.open)}
            hint={num(stats.unassignedOpen) + " unassigned"}
            tone="accent"
            icon={<LifeBuoy size={16} />}
          />
          <OpsMetricCard
            label="Pending"
            value={num(stats.pending)}
            hint="Waiting on someone"
            tone="warn"
          />
          <OpsMetricCard
            label="Resolved"
            value={num(stats.resolved)}
            hint="Closed out well"
            tone="good"
          />
          <OpsMetricCard
            label="All tickets"
            value={num(stats.total)}
            hint={num(stats.closed) + " closed"}
          />
        </div>
      </OpsSection>

      <OpsSection title="Tickets">
        <OpsFilterBar
          searchPlaceholder="Search subject or email…"
          filters={[
            {
              key: "status",
              label: "Status",
              options: [
                { value: "open", label: "Open" },
                { value: "pending", label: "Pending" },
                { value: "resolved", label: "Resolved" },
                { value: "closed", label: "Closed" },
              ],
            },
            {
              key: "priority",
              label: "Priority",
              options: [
                { value: "low", label: "Low" },
                { value: "normal", label: "Normal" },
                { value: "high", label: "High" },
                { value: "urgent", label: "Urgent" },
              ],
            },
            {
              key: "category",
              label: "Category",
              options: [
                { value: "account", label: "Account" },
                { value: "product_saving", label: "Saving items" },
                { value: "parser_failure", label: "Parser failure" },
                { value: "price_tracking", label: "Price tracking" },
                { value: "stock_tracking", label: "Stock tracking" },
                { value: "billing", label: "Billing" },
                { value: "privacy", label: "Privacy" },
                { value: "bug", label: "Bug" },
                { value: "feedback", label: "Feedback" },
                { value: "other", label: "Other" },
              ],
            },
          ]}
        />
        <OpsDataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.id}
          rowHref={(r) => "/ops/support/" + r.id}
          sort={lp.sort ?? undefined}
          sortHref={(k) => makeSortHref("/ops/support", lp.params, lp.sort, k)}
          pagination={{
            page: lp.page,
            pageSize: lp.pageSize,
            total,
            hrefForPage: (p) => makePageHref("/ops/support", lp.params, p),
          }}
        />
      </OpsSection>

      {/* Templates / macros — display-only canned responses */}
      <OpsSection
        title="Templates"
        description="Canned responses for consistent, calm replies. Copy and adapt as needed."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {MACROS.map((m) => (
            <GlassCard key={m.title} className="p-4">
              <div className="mb-1.5 flex items-center gap-2">
                <Copy size={14} className="text-silver" />
                <h3 className="text-sm font-medium text-ink">{m.title}</h3>
              </div>
              <p className="text-sm text-slate text-pretty">{m.body}</p>
            </GlassCard>
          ))}
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-silver">
          <Mail size={13} /> Customer email isn&apos;t integrated yet — send
          replies manually for now.
        </p>
      </OpsSection>
    </>
  );
}
