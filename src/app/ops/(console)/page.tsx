import {
  Activity,
  AlertTriangle,
  Bell,
  CreditCard,
  DollarSign,
  Package,
  PackageCheck,
  ScanLine,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { OpsPageHeader, OpsSection } from "@/components/ops/OpsPageHeader";
import { OpsMetricCard } from "@/components/ops/OpsMetricCard";
import { OpsChartCard } from "@/components/ops/OpsChartCard";
import { MiniBars, SuccessFailBars, Sparkline } from "@/components/ops/Charts";
import { OpsWheelHealth } from "@/components/ops/OpsWheelHealth";
import { OpsStatusPill } from "@/components/ops/OpsStatusPill";
import { GlassCard } from "@/components/ui/GlassCard";
import { getOverview } from "@/lib/ops/data/overview";
import { num, pct, usd } from "@/lib/ops/format";

/**
 * Ops Overview — the command center. A calm, scannable read on the whole of
 * UniKart: who's here, what's saved, how the parser and jobs are doing, what
 * it costs, and whether anything needs attention. Real DB metrics where we have
 * them; clearly-labelled demo only where a stream has no data yet.
 */
export const dynamic = "force-dynamic";

export default async function OpsOverviewPage() {
  const d = await getOverview();

  return (
    <>
      <OpsPageHeader
        title="Overview"
        description="A calm command center for UniKart — people, saved items, tracking, cost, and system health at a glance."
        actions={<OpsStatusPill status={d.systemStatus} />}
      />

      {/* People + saved items */}
      <OpsSection
        title="People & saved items"
        description="Growth and what people are considering."
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <OpsMetricCard
            label="Total users"
            value={num(d.totalUsers)}
            hint="Excludes test accounts"
            icon={<Users size={16} />}
          />
          <OpsMetricCard
            label="New users (7d)"
            value={num(d.newUsers.d7)}
            hint={num(d.newUsers.today) + " today · " + num(d.newUsers.d30) + " in 30d"}
            tone="accent"
            delta={d.newUsersDelta}
            icon={<TrendingUp size={16} />}
          />
          <OpsMetricCard
            label="Active users (7d)"
            value={num(d.activeUsers.d7)}
            hint={
              d.activeUsersSparse
                ? "Based on lastActiveAt (sparse)"
                : num(d.activeUsers.today) + " today · " + num(d.activeUsers.d30) + " in 30d"
            }
            icon={<Activity size={16} />}
          />
          <OpsMetricCard
            label="UniKart Coast users"
            value={num(d.coastUsers)}
            hint="On the paid plan"
            tone="accent"
            icon={<Wallet size={16} />}
          />
          <OpsMetricCard
            label="Products saved (total)"
            value={num(d.totalProducts)}
            hint={num(d.newProducts.today) + " today · " + num(d.newProducts.d7) + " in 7d"}
            delta={d.newProductsDelta}
            icon={<Package size={16} />}
          />
          <OpsMetricCard
            label="Currently tracked"
            value={num(d.trackedProducts)}
            hint="Not archived, purchased, or released"
            icon={<ScanLine size={16} />}
          />
          <OpsMetricCard
            label="Purchased"
            value={num(d.purchasedProducts)}
            hint="Bought on the merchant's site"
            tone="good"
            icon={<PackageCheck size={16} />}
          />
          <OpsMetricCard
            label="Released"
            value={num(d.releasedProducts)}
            hint="Consciously let go"
            icon={<Package size={16} />}
          />
        </div>
      </OpsSection>

      {/* Parser, tracking & engagement */}
      <OpsSection
        title="Parsing, tracking & engagement"
        description="How well we read pages, how often we check, and what reaches people."
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <OpsMetricCard
            label="Parser success rate"
            value={pct(d.parser.successRate)}
            hint="Last 30 days"
            tone="good"
            isDemo={d.parser.isDemo}
          />
          <OpsMetricCard
            label="Parser failure rate"
            value={pct(d.parser.failureRate)}
            hint="Last 30 days"
            tone={d.parser.failureRate > 10 ? "bad" : "neutral"}
            isDemo={d.parser.isDemo}
          />
          <OpsMetricCard
            label="Avg confidence"
            value={d.parser.avgConfidenceLabel}
            hint="Metadata confidence (30d)"
            isDemo={d.parser.isDemo}
          />
          <OpsMetricCard
            label="Universal Cart items"
            value={num(d.cartItemsActive)}
            hint="In active carts"
            icon={<ShoppingCart size={16} />}
          />
          <OpsMetricCard
            label="Price checks run"
            value={num(d.priceChecksScheduled)}
            hint="Scheduled snapshots"
          />
          <OpsMetricCard
            label="Stock checks run"
            value={num(d.stockChecks)}
            hint="Availability snapshots"
          />
          <OpsMetricCard
            label="Notifications generated"
            value={num(d.notificationsTotal)}
            hint={num(d.notificationsRead) + " read · " + pct(d.notificationsDeliveredRate) + " read rate"}
            icon={<Bell size={16} />}
          />
          <OpsMetricCard
            label="Checkout Assistant starts"
            value={num(d.checkout.started)}
            hint={num(d.checkout.completed) + " completed"}
            isDemo={d.checkout.isDemo}
          />
        </div>
      </OpsSection>

      {/* Money & reliability */}
      <OpsSection
        title="Money & reliability"
        description="Estimated cost, subscription revenue, and anything that needs attention."
      >
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <OpsMetricCard
            label="Infra / API cost (30d)"
            value={usd(d.cost.last30dUsd)}
            hint="Estimate"
            icon={<DollarSign size={16} />}
            isDemo={d.cost.isDemo}
          />
          <OpsMetricCard
            label="MRR"
            value={usd(d.mrrUsd)}
            hint={d.mrrIsPlaceholder ? "Estimate from list price" : "From active subscriptions"}
            tone="accent"
            icon={<CreditCard size={16} />}
            isDemo={d.mrrIsPlaceholder}
          />
          <OpsMetricCard
            label="Job failures (7d)"
            value={num(d.jobFailures7d)}
            hint="Background jobs"
            tone={d.jobFailures7d > 0 ? "bad" : "good"}
            icon={<AlertTriangle size={16} />}
          />
          <OpsMetricCard
            label="System status"
            value={
              d.systemStatus === "operational"
                ? "Operational"
                : d.systemStatus === "degraded"
                  ? "Degraded"
                  : d.systemStatus === "down"
                    ? "Down"
                    : "Unknown"
            }
            hint="Worst current service"
            tone={
              d.systemStatus === "operational"
                ? "good"
                : d.systemStatus === "degraded"
                  ? "warn"
                  : "bad"
            }
          />
        </div>
      </OpsSection>

      {/* Trends */}
      <OpsSection title="Trends" description="The last 30 days.">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <OpsChartCard
            title="User signups"
            subtitle="New accounts per day"
            value={num(d.newUsers.d30) + " in 30d"}
          >
            <MiniBars data={d.charts.signups} tone="accent" ariaLabel="User signups per day" />
          </OpsChartCard>

          <OpsChartCard
            title="Products saved"
            subtitle="Saved per day"
            value={num(d.newProducts.d30) + " in 30d"}
          >
            <MiniBars data={d.charts.productsSaved} tone="ink" ariaLabel="Products saved per day" />
          </OpsChartCard>

          <OpsChartCard
            title="Parser success vs failure"
            subtitle="Per day — green is success, muted red is failure"
            isDemo={d.charts.parserIsDemo}
          >
            <SuccessFailBars data={d.charts.parser} ariaLabel="Parser success and failure per day" />
          </OpsChartCard>

          <OpsChartCard
            title="Estimated cost"
            subtitle="Per day (estimate)"
            value={usd(d.cost.last30dUsd)}
            isDemo={d.charts.costIsDemo}
          >
            <Sparkline data={d.charts.cost} tone="warn" ariaLabel="Estimated daily cost" />
          </OpsChartCard>

          <OpsChartCard
            title="Notifications generated"
            subtitle="Per day"
            value={num(d.notificationsTotal) + " total"}
            className="lg:col-span-2"
          >
            <MiniBars data={d.charts.notifications} tone="slate" ariaLabel="Notifications per day" />
          </OpsChartCard>
        </div>
      </OpsSection>

      {/* System health */}
      <OpsSection title="System health" description="Each service as a spoke on the wheel.">
        <GlassCard className="p-5 sm:p-6">
          <OpsWheelHealth services={d.services} />
        </GlassCard>
      </OpsSection>
    </>
  );
}
