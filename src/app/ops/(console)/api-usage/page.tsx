import { Activity, AlertTriangle, Download, Gauge } from "lucide-react";
import { OpsPageHeader, OpsSection } from "@/components/ops/OpsPageHeader";
import { OpsMetricCard } from "@/components/ops/OpsMetricCard";
import { OpsChartCard } from "@/components/ops/OpsChartCard";
import { OpsDataTable, type OpsColumn } from "@/components/ops/OpsDataTable";
import { OpsStatusPill } from "@/components/ops/OpsStatusPill";
import { OpsEmptyState } from "@/components/ops/OpsEmptyState";
import { DemoBadge } from "@/components/ops/DemoBadge";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { MiniBars, HBars, Donut } from "@/components/ops/Charts";
import { getOpsViewer } from "@/lib/ops/viewer";
import { can } from "@/lib/ops/permissions";
import { getApiUsageDashboard, type ApiUsageRow } from "@/lib/ops/data/api-usage";
import { num, compact, pct, usd, duration, dateTime, shortId } from "@/lib/ops/format";
import { demoSeries } from "@/lib/ops/metrics";
import type { NamedValue } from "@/lib/ops/types";

/**
 * API Usage — read-only dashboard over first-party APIUsageEvent telemetry.
 *
 * Every figure is real when there's data. When telemetry is empty we render
 * clearly-labelled demo charts (DemoBadge), never fabricated numbers presented
 * as real. No request bodies / PII are ever surfaced (see data module note).
 */
export const dynamic = "force-dynamic";

export default async function ApiUsagePage() {
  const viewer = await getOpsViewer();
  const canExport = can(viewer, "apiUsage.export");

  const d = await getApiUsageDashboard();
  const isDemo = d.isDemo;

  // Demo fallbacks (clearly labelled) when there's no telemetry yet.
  const demoVolume = demoSeries("api-usage-volume", 30, 180, 90);
  const demoRoutes: NamedValue[] = [
    { name: "/api/track/products", value: 1840 },
    { name: "/api/enrich/apply", value: 1210 },
    { name: "/api/jobs/price-check", value: 640 },
    { name: "/api/track/apply", value: 420 },
    { name: "/api/health", value: 180 },
  ];
  const demoProviders: NamedValue[] = [
    { name: "anthropic", value: 12.4, display: usd(12.4) },
    { name: "scraperapi", value: 6.1, display: usd(6.1) },
    { name: "resend", value: 1.2, display: usd(1.2) },
  ];

  const volume = isDemo ? demoVolume : d.dailyVolume;
  const routeBars = isDemo ? demoRoutes : d.byRoute;
  const providerSegments = isDemo ? demoProviders : d.costByProvider;

  const failureColumns: OpsColumn<ApiUsageRow>[] = [
    {
      key: "createdAt",
      header: "When",
      render: (r) => <span className="whitespace-nowrap text-slate">{dateTime(r.createdAt)}</span>,
    },
    {
      key: "route",
      header: "Route",
      render: (r) => (
        <span className="font-mono text-[0.8125rem] text-ink">{r.route}</span>
      ),
    },
    {
      key: "method",
      header: "Method",
      render: (r) => <span className="text-slate">{r.method}</span>,
    },
    {
      key: "statusCode",
      header: "Status",
      align: "right",
      render: (r) => (
        <OpsStatusPill status={r.statusCode >= 500 ? "error" : "failed"} label={String(r.statusCode)} />
      ),
    },
    {
      key: "durationMs",
      header: "Latency",
      align: "right",
      render: (r) => (
        <span className="tabular-nums text-slate">{duration(r.durationMs)}</span>
      ),
    },
    {
      key: "provider",
      header: "Provider",
      render: (r) => <span className="text-slate">{r.provider ?? "—"}</span>,
    },
  ];

  return (
    <>
      <OpsPageHeader
        title="API Usage"
        description="First-party request telemetry across UniKart routes and providers. Read-only."
        actions={
          canExport ? (
            <Button href="/api/ops/export/api-usage" variant="secondary" size="sm">
              <Download size={15} />
              Export CSV
            </Button>
          ) : undefined
        }
      />

      {isDemo && (
        <div className="mb-6 flex items-center gap-2 rounded-2xl border border-line bg-canvas/60 px-4 py-3 text-sm text-slate">
          <DemoBadge />
          <span>
            No usage telemetry recorded yet. The figures below are illustrative and update
            automatically once requests start logging.
          </span>
        </div>
      )}

      {/* Window cards */}
      <OpsSection title="Requests" description="Logged API events by window.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <OpsMetricCard
            label="Today"
            value={num(d.windows.today)}
            hint="Since midnight"
            icon={<Activity size={16} />}
            isDemo={isDemo}
          />
          <OpsMetricCard
            label="Last 7 days"
            value={num(d.windows.d7)}
            delta={isDemo ? undefined : d.requestsDelta}
            hint="vs prior 7 days"
            isDemo={isDemo}
          />
          <OpsMetricCard
            label="Last 30 days"
            value={num(d.windows.d30)}
            isDemo={isDemo}
          />
          <OpsMetricCard
            label="Error rate"
            value={isDemo ? "2.1%" : pct(d.errorRatePct)}
            tone={!isDemo && d.errorRatePct >= 5 ? "warn" : "neutral"}
            delta={isDemo ? undefined : d.errorRateDelta}
            hint={isDemo ? "Status ≥ 400" : `${num(d.failedCount)} of ${compact(d.sampleSize)} (status ≥ 400)`}
            icon={<AlertTriangle size={16} />}
            isDemo={isDemo}
          />
        </div>
      </OpsSection>

      {/* Latency */}
      <OpsSection title="Latency" description="Computed from recorded request durations.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <OpsMetricCard
            label="p50 latency"
            value={isDemo ? "120ms" : duration(d.latency.p50)}
            icon={<Gauge size={16} />}
            isDemo={isDemo}
          />
          <OpsMetricCard
            label="p95 latency"
            value={isDemo ? "640ms" : duration(d.latency.p95)}
            isDemo={isDemo}
          />
          <OpsMetricCard
            label="p99 latency"
            value={isDemo ? "1.4s" : duration(d.latency.p99)}
            isDemo={isDemo}
          />
        </div>
      </OpsSection>

      {/* Trend + cost by provider */}
      <OpsSection title="Trends">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <OpsChartCard
            title="Daily usage"
            subtitle="Requests per day, last 30 days"
            value={isDemo ? undefined : compact(d.windows.d30)}
            isDemo={isDemo}
            className="lg:col-span-2"
          >
            <MiniBars data={volume} height={120} tone="accent" ariaLabel="Daily API requests over the last 30 days" />
          </OpsChartCard>

          <OpsChartCard
            title="Estimated cost by provider"
            subtitle="Sum of recorded estimates"
            value={isDemo ? undefined : usd(d.totalEstimatedCostUsd)}
            isDemo={isDemo}
          >
            {providerSegments.length > 0 ? (
              <Donut
                segments={providerSegments}
                centerLabel={usd(
                  isDemo
                    ? demoProviders.reduce((s, p) => s + p.value, 0)
                    : d.totalEstimatedCostUsd,
                )}
                centerSub="estimate"
              />
            ) : (
              <p className="py-8 text-center text-xs text-silver">No cost estimates recorded yet.</p>
            )}
          </OpsChartCard>
        </div>
      </OpsSection>

      {/* Requests by route + errors by route */}
      <OpsSection title="By route">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <OpsChartCard title="Requests by route" subtitle="Top routes by volume" isDemo={isDemo}>
            {routeBars.length > 0 ? (
              <HBars data={routeBars} tone="accent" />
            ) : (
              <p className="py-6 text-center text-xs text-silver">No route data yet.</p>
            )}
          </OpsChartCard>

          <OpsChartCard
            title="Errors by route"
            subtitle="Requests with status ≥ 400"
            isDemo={isDemo}
          >
            {isDemo ? (
              <HBars
                data={[
                  { name: "/api/enrich/apply", value: 28 },
                  { name: "/api/track/products", value: 11 },
                  { name: "/api/jobs/price-check", value: 4 },
                ]}
                tone="up"
              />
            ) : d.errorsByRoute.length > 0 ? (
              <HBars data={d.errorsByRoute} tone="up" />
            ) : (
              <p className="py-6 text-center text-xs text-down">No errors recorded. Steady and quiet.</p>
            )}
          </OpsChartCard>
        </div>
      </OpsSection>

      {/* Top users */}
      <OpsSection title="Top users" description="Highest request counts (resolved to email where known).">
        <GlassCard className="p-5">
          {isDemo ? (
            <HBars
              data={[
                { name: "alex@example.com", value: 420 },
                { name: shortId("clz9xq8a8f2k0001"), value: 280 },
                { name: "sam@example.com", value: 150 },
              ]}
              tone="slate"
            />
          ) : d.topUsers.length > 0 ? (
            <HBars data={d.topUsers} tone="slate" />
          ) : (
            <p className="py-6 text-center text-xs text-silver">
              No user-attributed requests yet.
            </p>
          )}
          {isDemo && (
            <div className="mt-4">
              <DemoBadge />
            </div>
          )}
        </GlassCard>
      </OpsSection>

      {/* Recent failures */}
      <OpsSection
        title="Recent failures"
        description="Most recent requests with status ≥ 400."
      >
        {isDemo ? (
          <OpsEmptyState
            title="No failures to show yet"
            description="Failed requests will appear here once telemetry is logging."
            icon={<AlertTriangle size={20} />}
          />
        ) : (
          <OpsDataTable<ApiUsageRow>
            columns={failureColumns}
            rows={d.recentFailures}
            getRowKey={(r) => r.id}
            empty={
              <OpsEmptyState
                title="No recent failures"
                description="No requests returned status ≥ 400 in the recent sample."
                icon={<AlertTriangle size={20} />}
              />
            }
          />
        )}
      </OpsSection>
    </>
  );
}
