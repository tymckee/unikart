import { Download, DollarSign, Users, Package, Bell, ScanLine } from "lucide-react";
import { OpsPageHeader, OpsSection } from "@/components/ops/OpsPageHeader";
import { OpsMetricCard } from "@/components/ops/OpsMetricCard";
import { OpsChartCard } from "@/components/ops/OpsChartCard";
import { OpsEmptyState } from "@/components/ops/OpsEmptyState";
import { DemoBadge } from "@/components/ops/DemoBadge";
import { Sparkline, MiniBars, Donut, HBars } from "@/components/ops/Charts";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { CostConfig } from "@/components/ops/costs/CostConfig";
import { getCostDashboard, getCostRates } from "@/lib/ops/data/costs";
import { updateCostRates } from "@/lib/ops/actions/costs";
import { getOpsViewer } from "@/lib/ops/viewer";
import { can } from "@/lib/ops/permissions";
import { costEstimateMode } from "@/lib/ops/env";
import { usd, num } from "@/lib/ops/format";
import { delta, demoSeries } from "@/lib/ops/metrics";
import type { NamedValue } from "@/lib/ops/types";

export const dynamic = "force-dynamic";

/** Cost-per-X: returns a formatted string, or "—" when the denominator is zero. */
function perUnit(total: number, denominator: number): string {
  if (!denominator || denominator <= 0) return "—";
  return usd(total / denominator);
}

export default async function CostsPage() {
  const viewer = await getOpsViewer();
  const canEdit = can(viewer, "costs.mutate");
  const canExport = can(viewer, "costs.export");

  const [dashboard, rates] = await Promise.all([getCostDashboard(), getCostRates()]);

  const estimatesMode = costEstimateMode();
  const isDemo = dashboard.isDemo;
  const { totals, denominators } = dashboard;

  // Monthly (last 30d) estimated spend, with a prior-30d delta. Up is bad here.
  const monthlyDelta = delta(totals.d30, totals.d60to30, false);

  // Daily trend: real data when present; a clearly-labelled demo series otherwise.
  const trend = isDemo ? demoSeries("costs-daily", 30, 4, 6) : dashboard.dailyTrend;

  // For groupings, attach a formatted display so the charts read in dollars.
  const withUsd = (items: NamedValue[]): NamedValue[] =>
    items.map((x) => ({ ...x, display: usd(x.value) }));

  const byProvider = withUsd(dashboard.byProvider);
  const topUsers = withUsd(dashboard.topUsers);
  const topProducts = withUsd(dashboard.topProducts);
  const topDomains = withUsd(dashboard.topDomains);

  return (
    <>
      <OpsPageHeader
        title="Costs"
        description="What it costs to run UniKart. Every figure here is an estimate, built from a configurable per-unit rate card — treat it as a directional guide, not an invoice."
        actions={
          canExport ? (
            <Button href="/api/ops/export/costs" variant="secondary" size="sm">
              <Download size={15} />
              Export CSV
            </Button>
          ) : undefined
        }
      />

      {/* Estimates banner — always visible, prominent and calm. */}
      <GlassCard className="mb-6 flex flex-wrap items-center gap-3 px-5 py-4">
        <Pill tone="warn">Estimates</Pill>
        <p className="min-w-0 flex-1 text-sm text-slate text-pretty">
          {estimatesMode
            ? "Costs are estimated from configurable per-unit rates, not provider invoices. Exact rates vary by plan and usage."
            : "Some figures are confirmed; any row marked estimated uses a configurable per-unit rate."}
        </p>
      </GlassCard>

      {/* Headline metrics */}
      <OpsSection>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <OpsMetricCard
            label="Estimated spend · last 30 days"
            value={usd(totals.d30)}
            hint="vs the prior 30 days"
            tone="neutral"
            delta={isDemo ? null : monthlyDelta}
            isDemo={isDemo}
            icon={<DollarSign size={16} />}
          />
          <OpsMetricCard
            label="Estimated spend · last 7 days"
            value={usd(totals.d7)}
            isDemo={isDemo}
          />
          <OpsMetricCard
            label="Estimated spend · today"
            value={usd(totals.today)}
            isDemo={isDemo}
          />
          <OpsMetricCard
            label="Per active user · 30 days"
            value={perUnit(totals.d30, denominators.activeUsers)}
            hint={num(denominators.activeUsers) + " active in 30 days"}
            tone="accent"
            isDemo={isDemo}
            icon={<Users size={16} />}
          />
        </div>
      </OpsSection>

      {/* Efficiency: cost per X */}
      <OpsSection
        title="Cost efficiency"
        description="Estimated spend over the things that drive it. A blank value means there's nothing to divide by yet."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <OpsMetricCard
            label="Per product tracked"
            value={perUnit(totals.d30, denominators.productsTracked)}
            hint={num(denominators.productsTracked) + " tracked"}
            isDemo={isDemo}
            icon={<Package size={16} />}
          />
          <OpsMetricCard
            label="Per parser success · 30 days"
            value={perUnit(totals.d30, denominators.parserSuccesses)}
            hint={num(denominators.parserSuccesses) + " successful parses"}
            isDemo={isDemo}
            icon={<ScanLine size={16} />}
          />
          <OpsMetricCard
            label="Per notification · 30 days"
            value={perUnit(totals.d30, denominators.notifications)}
            hint={num(denominators.notifications) + " sent"}
            isDemo={isDemo}
            icon={<Bell size={16} />}
          />
        </div>
      </OpsSection>

      {/* Trend + provider mix */}
      <OpsSection>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <OpsChartCard
            title="Daily estimated spend"
            subtitle="Last 30 days"
            value={usd(totals.d30)}
            isDemo={isDemo}
            className="lg:col-span-2"
          >
            {isDemo ? (
              <Sparkline data={trend} tone="accent" height={120} ariaLabel="Estimated daily spend, demo data" />
            ) : (
              <MiniBars data={trend} tone="accent" height={120} ariaLabel="Estimated daily spend" />
            )}
          </OpsChartCard>

          <OpsChartCard title="By provider" subtitle="Last 30 days" isDemo={isDemo}>
            {byProvider.length > 0 ? (
              <Donut
                segments={byProvider}
                centerLabel={usd(totals.d30)}
                centerSub="30-day est."
              />
            ) : (
              <NoGroupingData />
            )}
          </OpsChartCard>
        </div>
      </OpsSection>

      {/* Top cost drivers */}
      <OpsSection
        title="Top cost drivers"
        description="Where estimated spend is concentrated over the last 30 days."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <TopList title="Users" data={topUsers} isDemo={isDemo} tone="accent" />
          <TopList title="Products" data={topProducts} isDemo={isDemo} tone="down" />
          <TopList
            title="Operations"
            data={topDomains}
            isDemo={isDemo}
            tone="slate"
            subtitle="By ledger operation (cost source)"
          />
        </div>
      </OpsSection>

      {/* Rate card / config */}
      <OpsSection
        title="Rate card"
        description="The per-unit estimates behind every figure above."
      >
        <CostConfig rates={rates} canEdit={canEdit} updateAction={updateCostRates} />
      </OpsSection>
    </>
  );
}

/** A single "top cost drivers" panel. */
function TopList({
  title,
  data,
  isDemo,
  tone,
  subtitle,
}: {
  title: string;
  data: NamedValue[];
  isDemo: boolean;
  tone: "accent" | "down" | "slate";
  subtitle?: string;
}) {
  return (
    <GlassCard className="flex flex-col p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate">{subtitle}</p>}
        </div>
        {isDemo && <DemoBadge />}
      </div>
      <div className="mt-auto">
        {data.length > 0 ? (
          <HBars data={data} tone={tone} />
        ) : (
          <NoGroupingData />
        )}
      </div>
    </GlassCard>
  );
}

function NoGroupingData() {
  return (
    <OpsEmptyState
      title="No cost data yet"
      description="Figures appear here once the cost ledger has entries."
    />
  );
}
