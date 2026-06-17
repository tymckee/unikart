import {
  CreditCard,
  CircleDollarSign,
  Users,
  AlertTriangle,
  TrendingDown,
  Check,
  CircleDashed,
} from "lucide-react";
import { OpsPageHeader, OpsSection } from "@/components/ops/OpsPageHeader";
import { OpsMetricCard } from "@/components/ops/OpsMetricCard";
import { OpsChartCard } from "@/components/ops/OpsChartCard";
import { OpsDataTable, type OpsColumn } from "@/components/ops/OpsDataTable";
import { OpsFilterBar } from "@/components/ops/OpsFilterBar";
import { OpsStatusPill } from "@/components/ops/OpsStatusPill";
import { OpsEmptyState } from "@/components/ops/OpsEmptyState";
import { Donut } from "@/components/ops/Charts";
import { GlassCard } from "@/components/ui/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { BillingActions } from "@/components/ops/billing/BillingActions";
import {
  getBillingOverview,
  getBillingSubscriptions,
  planLabel,
  type BillingRow,
  type StripeReadiness,
} from "@/lib/ops/data/billing";
import {
  refundCharge,
  applyCredit,
  cancelSubscription,
} from "@/lib/ops/actions/billing";
import { getOpsViewer } from "@/lib/ops/viewer";
import { can } from "@/lib/ops/permissions";
import { readListParams, makeSortHref, makePageHref } from "@/lib/ops/data/common";
import { usd, num, shortDate } from "@/lib/ops/format";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const viewer = await getOpsViewer();
  const canRefund = can(viewer, "billing.refund");

  const lp = readListParams(sp, {
    defaultSort: { key: "periodEnd", dir: "desc" },
    sortableKeys: ["periodEnd", "trialEnd", "status"],
    pageSize: 25,
  });

  const [overview, subs] = await Promise.all([
    getBillingOverview(),
    getBillingSubscriptions(lp),
  ]);

  const { planMix, statusCounts, isDemo } = overview;

  const columns: OpsColumn<BillingRow>[] = [
    {
      key: "user",
      header: "Customer",
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate text-ink">{row.userEmail}</div>
          {row.userName !== "—" && (
            <div className="truncate text-xs text-silver">{row.userName}</div>
          )}
        </div>
      ),
    },
    {
      key: "plan",
      header: "Plan",
      render: (row) => (
        <Pill tone={row.plan === "pro" ? "accent" : "neutral"}>
          {planLabel(row.plan)}
        </Pill>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <OpsStatusPill status={row.status} />
          {row.cancelAtPeriodEnd && (
            <span className="text-xs text-silver">cancels at period end</span>
          )}
        </div>
      ),
    },
    {
      key: "interval",
      header: "Interval",
      render: (row) => (
        <span className="capitalize text-slate">
          {row.billingInterval ? row.billingInterval + "ly" : "—"}
        </span>
      ),
    },
    {
      key: "trialEnd",
      header: "Trial ends",
      sortable: true,
      align: "right",
      render: (row) => (
        <span className="tabular-nums text-slate">{shortDate(row.trialEnd)}</span>
      ),
    },
    {
      key: "periodEnd",
      header: "Renews",
      sortable: true,
      align: "right",
      render: (row) => (
        <span className="tabular-nums text-slate">{shortDate(row.periodEnd)}</span>
      ),
    },
  ];

  return (
    <>
      <OpsPageHeader
        title="Billing"
        description="UniKart Coast subscriptions, read from the local billing records. The only thing UniKart bills for is the Coast subscription — purchases always stay on the merchant's own site."
      />

      {/* Test-mode banner — prominent, calm. */}
      <GlassCard className="mb-6 flex flex-wrap items-center gap-3 px-5 py-4">
        <Pill tone="warn" dot>
          Stripe is in test mode
        </Pill>
        <p className="min-w-0 flex-1 text-sm text-slate text-pretty">
          These figures come from local billing records, not live Stripe data. No
          card data is stored or shown here, and money-moving actions are not
          enabled yet.
        </p>
      </GlassCard>

      {/* Headline metrics */}
      <OpsSection>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OpsMetricCard
            label="MRR estimate"
            value={usd(overview.mrrEstimateUsd)}
            hint={
              num(overview.earningSubs) +
              " active or trialing · $5/mo, $49/yr assumed"
            }
            tone="accent"
            isDemo={isDemo}
            icon={<CircleDollarSign size={16} />}
          />
          <OpsMetricCard
            label="UniKart Coast subscribers"
            value={num(planMix.coast)}
            hint={num(planMix.total) + " users total"}
            isDemo={isDemo}
            icon={<Users size={16} />}
          />
          <OpsMetricCard
            label="Past-due subscriptions"
            value={num(overview.pastDueCount)}
            hint="failed or overdue payment"
            tone={overview.pastDueCount > 0 ? "warn" : "neutral"}
            isDemo={isDemo}
            icon={<AlertTriangle size={16} />}
          />
          <OpsMetricCard
            label="Canceled · last 30 days"
            value={num(overview.canceledLast30d)}
            hint="churn placeholder — not a rate yet"
            tone="neutral"
            isDemo={isDemo}
            icon={<TrendingDown size={16} />}
          />
        </div>
      </OpsSection>

      {/* Plan mix + readiness */}
      <OpsSection>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <OpsChartCard
            title="Plan distribution"
            subtitle="Free vs UniKart Coast across all users"
            isDemo={isDemo}
          >
            {planMix.total > 0 ? (
              <Donut
                segments={overview.planSegments}
                centerLabel={num(planMix.total)}
                centerSub="users"
              />
            ) : (
              <OpsEmptyState
                title="No users yet"
                description="Plan distribution appears once there are accounts."
              />
            )}
          </OpsChartCard>

          <ReadinessChecklist items={overview.readiness} className="lg:col-span-2" />
        </div>
      </OpsSection>

      {/* Subscription status summary */}
      <OpsSection
        title="Subscription status"
        description="A calm tally of where current subscriptions stand."
      >
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
          <OpsMetricCard label="Active" value={num(statusCounts.active)} tone="good" isDemo={isDemo} />
          <OpsMetricCard label="Trialing" value={num(statusCounts.trialing)} tone="accent" isDemo={isDemo} />
          <OpsMetricCard
            label="Past due"
            value={num(statusCounts.pastDue)}
            tone={statusCounts.pastDue > 0 ? "warn" : "neutral"}
            isDemo={isDemo}
          />
          <OpsMetricCard label="Canceled" value={num(statusCounts.canceled)} isDemo={isDemo} />
          <OpsMetricCard label="Other" value={num(statusCounts.other)} isDemo={isDemo} />
        </div>
      </OpsSection>

      {/* Actions (disabled in v1) */}
      <OpsSection
        title="Actions"
        description="Refunds, credits, and cancellations stay disabled while Stripe is in test mode."
      >
        <BillingActions
          canRefund={canRefund}
          refundAction={refundCharge}
          applyCreditAction={applyCredit}
          cancelAction={cancelSubscription}
        />
      </OpsSection>

      {/* Subscriptions table */}
      <OpsSection
        title="Subscriptions"
        description="Every UniKart Coast subscription, newest renewal first. No card data is shown."
      >
        <OpsFilterBar
          searchPlaceholder="Search by email, name, or id…"
          filters={[
            {
              key: "status",
              label: "Status",
              options: [
                { value: "active", label: "Active" },
                { value: "trialing", label: "Trialing" },
                { value: "past_due", label: "Past due" },
                { value: "canceled", label: "Canceled" },
                { value: "incomplete", label: "Incomplete" },
              ],
            },
            {
              key: "interval",
              label: "Interval",
              options: [
                { value: "month", label: "Monthly" },
                { value: "year", label: "Annual" },
              ],
            },
          ]}
        />
        <div className="mt-4">
          <OpsDataTable
            columns={columns}
            rows={subs.rows}
            getRowKey={(row) => row.id}
            sort={lp.sort ?? undefined}
            sortHref={(k) => makeSortHref("/ops/billing", lp.params, lp.sort, k)}
            pagination={{
              page: lp.page,
              pageSize: lp.pageSize,
              total: subs.total,
              hrefForPage: (p) => makePageHref("/ops/billing", lp.params, p),
            }}
            empty={
              <OpsEmptyState
                title="No subscriptions yet"
                description="UniKart Coast subscriptions appear here once customers subscribe."
              />
            }
          />
        </div>
      </OpsSection>
    </>
  );
}

/**
 * Stripe go-live readiness. Informational only — each item is derived from
 * non-secret env presence where possible (we never read or render the value).
 * "Confirmed" means present/derivable; "to confirm" is a manual gate.
 */
function ReadinessChecklist({
  items,
  className,
}: {
  items: StripeReadiness[];
  className?: string;
}) {
  return (
    <GlassCard className={"flex flex-col p-5 " + (className ?? "")}>
      <div className="mb-1 flex items-center gap-2">
        <CreditCard size={15} className="text-silver" />
        <h3 className="text-sm font-semibold tracking-tight text-ink">
          Go-live readiness
        </h3>
      </div>
      <p className="mb-4 text-xs text-slate text-pretty">
        What&apos;s left before UniKart Coast can bill in live mode. Derived from
        configuration presence — never from the secret values themselves.
      </p>
      <ul className="divide-y divide-line">
        {items.map((item) => (
          <li key={item.key} className="flex items-start gap-3 py-2.5">
            <span className="mt-0.5 shrink-0">
              {item.ready ? (
                <Check size={15} className="text-down" />
              ) : (
                <CircleDashed size={15} className="text-silver" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink">{item.label}</span>
                {item.ready ? (
                  <Pill tone="down">Confirmed</Pill>
                ) : (
                  <Pill tone="outline">To confirm</Pill>
                )}
              </div>
              <p className="mt-0.5 text-xs text-slate text-pretty">{item.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
