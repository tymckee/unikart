import {
  ScanLine,
  CheckCircle2,
  AlertTriangle,
  Gauge,
  Download,
  Eye,
  TimerReset,
  PlugZap,
} from "lucide-react";
import { OpsPageHeader, OpsSection } from "@/components/ops/OpsPageHeader";
import { OpsMetricCard } from "@/components/ops/OpsMetricCard";
import { OpsChartCard } from "@/components/ops/OpsChartCard";
import { OpsDataTable, type OpsColumn } from "@/components/ops/OpsDataTable";
import { OpsStatusPill } from "@/components/ops/OpsStatusPill";
import { OpsEmptyState } from "@/components/ops/OpsEmptyState";
import { DemoBadge } from "@/components/ops/DemoBadge";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { SuccessFailBars, HBars, Donut } from "@/components/ops/Charts";
import {
  ParseAttemptActions,
  DomainActions,
  RetryUrlForm,
} from "@/components/ops/parser/ParserActions";
import { getOpsViewer } from "@/lib/ops/viewer";
import { can } from "@/lib/ops/permissions";
import {
  getParserDashboard,
  getWatchlistedDomains,
  extractionLabel,
  type DomainHealth,
} from "@/lib/ops/data/parser";
import {
  retryParse,
  watchlistDomain,
  addDomainNote,
} from "@/lib/ops/actions/parser";
import { num, pct, ratioPct, duration, dateTime, truncate } from "@/lib/ops/format";
import { bucketSuccessFailByDay } from "@/lib/ops/metrics";
import type { ChartPoint, NamedValue } from "@/lib/ops/types";

/**
 * Parser — health of UniKart's URL parser, the thing the whole product depends
 * on. Read straight from ParseAttempt telemetry: success/failure rate,
 * confidence, per-domain health, the most common failure reasons, and which
 * extraction source produced each result.
 *
 * Every figure is real when there's data. With no telemetry yet we render a
 * calm empty state plus clearly-labelled demo charts (DemoBadge) — never
 * fabricated numbers presented as real. No page bodies, cookies, or credentials
 * are ever surfaced (see the data module + recorder notes).
 */
export const dynamic = "force-dynamic";

/** Deterministic, clearly-labelled demo trend for the empty state. */
function demoTrend(): ChartPoint[] {
  // Build a stable success/fail series from a fixed seed of fake attempts.
  const now = Date.now();
  const seeded: { createdAt: Date; ok: boolean }[] = [];
  for (let day = 0; day < 30; day++) {
    const base = 18 + (day % 5) * 3;
    for (let i = 0; i < base; i++) {
      const ok = (day * 7 + i * 3) % 10 > 1; // ~80% success
      seeded.push({ createdAt: new Date(now - day * 86_400_000), ok });
    }
  }
  return bucketSuccessFailByDay(seeded, (s) => s.createdAt, (s) => s.ok, 30, now);
}

export default async function ParserPage() {
  const viewer = await getOpsViewer();
  const canExport = can(viewer, "parser.export");
  const canRetry = can(viewer, "parser.retry");
  const canMutate = can(viewer, "parser.mutate");

  const [d, watchlist] = await Promise.all([
    getParserDashboard(),
    getWatchlistedDomains(),
  ]);

  const isDemo = d.isEmpty;
  const watchSet = new Set(watchlist.domains);

  // Clearly-labelled demo fallbacks for the empty state.
  const demoTrendData = demoTrend();
  const demoExtraction: NamedValue[] = [
    { name: "JSON-LD", value: 58 },
    { name: "Open Graph", value: 22 },
    { name: "Ecommerce meta", value: 11 },
    { name: "HTML fallback", value: 6 },
    { name: "Manual fallback", value: 3 },
  ];
  const demoFailureReasons: NamedValue[] = [
    { name: "timeout", value: 14 },
    { name: "no_price_found", value: 9 },
    { name: "blocked_403", value: 6 },
    { name: "selector_miss", value: 4 },
  ];
  const demoNeedsAdapter: NamedValue[] = [
    { name: "shop.example-furniture.com", value: 41, display: "41%" },
    { name: "deals.example-tech.io", value: 53, display: "53%" },
    { name: "store.example-outdoors.co", value: 62, display: "62%" },
  ];

  const trend = isDemo ? demoTrendData : d.trend;
  const extractionSegments = isDemo ? demoExtraction : d.extractionDist;
  const failureReasons = isDemo ? demoFailureReasons : d.failureReasons;

  /** Shared renderer for the per-domain health tables. */
  function domainColumns(opts: { showActions: boolean }): OpsColumn<DomainHealth>[] {
    const cols: OpsColumn<DomainHealth>[] = [
      {
        key: "domain",
        header: "Domain",
        render: (r) => (
          <span className="inline-flex items-center gap-2">
            <span className="font-medium text-ink">{truncate(r.domain, 40)}</span>
            {watchSet.has(r.domain) && (
              <Pill tone="warn" dot icon={<Eye size={11} />}>
                Watchlisted
              </Pill>
            )}
          </span>
        ),
      },
      {
        key: "successRate",
        header: "Success",
        align: "right",
        render: (r) => (
          <span
            className={
              "tabular-nums " +
              (r.successRate >= 90
                ? "text-down"
                : r.successRate < 70
                  ? "text-up"
                  : "text-warn")
            }
          >
            {pct(r.successRate, 0)}
          </span>
        ),
      },
      {
        key: "total",
        header: "Attempts",
        align: "right",
        render: (r) => <span className="tabular-nums text-slate">{num(r.total)}</span>,
      },
      {
        key: "avgConfidence",
        header: "Avg confidence",
        align: "right",
        render: (r) => (
          <span className="tabular-nums text-slate">
            {r.avgConfidence == null ? "—" : ratioPct(r.avgConfidence, 0)}
          </span>
        ),
      },
      {
        key: "avgDurationMs",
        header: "Avg duration",
        align: "right",
        render: (r) => (
          <span className="tabular-nums text-slate">{duration(r.avgDurationMs)}</span>
        ),
      },
    ];
    if (opts.showActions && canMutate) {
      cols.push({
        key: "actions",
        header: "",
        align: "right",
        action: true,
        render: (r) => (
          <DomainActions
            domain={r.domain}
            watchlisted={watchSet.has(r.domain)}
            watchlistDomain={watchlistDomain}
            addDomainNote={addDomainNote}
            canMutate={canMutate}
          />
        ),
      });
    }
    return cols;
  }

  // Recent attempts table columns.
  const recentColumns: OpsColumn<(typeof d.recent)[number]>[] = [
    {
      key: "createdAt",
      header: "When",
      render: (r) => <span className="whitespace-nowrap text-slate">{dateTime(r.createdAt)}</span>,
    },
    {
      key: "domain",
      header: "Domain",
      render: (r) => (
        <span className="inline-flex items-center gap-2">
          <span className="font-medium text-ink">{truncate(r.domain, 32)}</span>
          {watchSet.has(r.domain) && (
            <Pill tone="warn" dot>
              Watchlisted
            </Pill>
          )}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <OpsStatusPill status={r.status} />,
    },
    {
      key: "confidence",
      header: "Confidence",
      render: (r) =>
        r.confidence ? (
          <OpsStatusPill
            status={r.confidence === "high" ? "success" : r.confidence === "low" ? "failed" : "partial"}
            label={r.confidence}
          />
        ) : (
          <span className="text-silver">—</span>
        ),
    },
    {
      key: "extractionMethod",
      header: "Source",
      render: (r) => <span className="text-slate">{extractionLabel(r.extractionMethod)}</span>,
    },
    {
      key: "durationMs",
      header: "Duration",
      align: "right",
      render: (r) => <span className="tabular-nums text-slate">{duration(r.durationMs)}</span>,
    },
    {
      key: "errorCode",
      header: "Error",
      render: (r) =>
        r.status === "failed" ? (
          <span className="text-up">{r.errorCode ?? truncate(r.errorMessage, 28) ?? "—"}</span>
        ) : (
          <span className="text-silver">—</span>
        ),
    },
  ];

  if (canRetry || canMutate) {
    recentColumns.push({
      key: "actions",
      header: "",
      align: "right",
      action: true,
      render: (r) => (
        <ParseAttemptActions
          attemptId={r.id}
          domain={r.domain}
          watchlisted={watchSet.has(r.domain)}
          retryParse={retryParse}
          watchlistDomain={watchlistDomain}
          addDomainNote={addDomainNote}
          canRetry={canRetry}
          canMutate={canMutate}
        />
      ),
    });
  }

  return (
    <>
      <OpsPageHeader
        title="Parser"
        description="Health of UniKart's URL parser — the foundation every saved item depends on. Read from parse telemetry."
        actions={
          canExport ? (
            <Button href="/api/ops/export/parser-failures" variant="secondary" size="sm">
              <Download size={15} />
              Export failures
            </Button>
          ) : undefined
        }
      />

      {isDemo && (
        <div className="mb-6 flex items-start gap-2 rounded-2xl border border-line bg-canvas/60 px-4 py-3 text-sm text-slate">
          <DemoBadge />
          <span>
            No parse attempts recorded yet. The figures below are illustrative and update
            automatically once the parser starts logging. Parsing reads public product metadata
            only — no logins, no aggressive scraping.
          </span>
        </div>
      )}

      {/* Headline rates */}
      <OpsSection title="Parse health" description="Across recent parse attempts.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <OpsMetricCard
            label="Success rate"
            value={isDemo ? "81%" : pct(d.totals.successRate, 0)}
            tone={!isDemo && d.totals.successRate >= 90 ? "good" : "neutral"}
            hint={isDemo ? "Status success" : num(d.totals.success) + " of " + num(d.totals.total) + " attempts"}
            icon={<CheckCircle2 size={16} />}
            isDemo={isDemo}
          />
          <OpsMetricCard
            label="Failure rate"
            value={isDemo ? "12%" : pct(d.totals.failureRate, 0)}
            tone={!isDemo && d.totals.failureRate >= 15 ? "warn" : "neutral"}
            hint={isDemo ? "Status failed" : num(d.totals.failed) + " failed"}
            icon={<AlertTriangle size={16} />}
            isDemo={isDemo}
          />
          <OpsMetricCard
            label="Avg confidence"
            value={isDemo ? "78%" : d.totals.avgConfidence == null ? "—" : ratioPct(d.totals.avgConfidence, 0)}
            hint="high 1.0 · medium 0.6 · low 0.3"
            icon={<Gauge size={16} />}
            isDemo={isDemo}
          />
          <OpsMetricCard
            label="Partial parses"
            value={isDemo ? "7%" : pct(d.totals.total ? (d.totals.partial / d.totals.total) * 100 : 0, 0)}
            hint={isDemo ? "Status partial" : num(d.totals.partial) + " partial"}
            isDemo={isDemo}
          />
        </div>
      </OpsSection>

      {/* Trend + confidence + extraction source */}
      <OpsSection title="Trends">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <OpsChartCard
            title="Success vs failure"
            subtitle="Per day, last 30 days"
            isDemo={isDemo}
            className="lg:col-span-2"
          >
            <SuccessFailBars
              data={trend}
              height={130}
              ariaLabel="Successful and failed parses per day over the last 30 days"
            />
            <div className="mt-3 flex items-center gap-4 text-xs text-slate">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-down" /> Success
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-up" /> Failed
              </span>
            </div>
          </OpsChartCard>

          <OpsChartCard
            title="Extraction source"
            subtitle="Where the metadata came from"
            isDemo={isDemo}
          >
            {extractionSegments.length > 0 ? (
              <Donut segments={extractionSegments} centerLabel={isDemo ? "demo" : num(d.totals.total)} centerSub="attempts" />
            ) : (
              <p className="py-8 text-center text-xs text-silver">No extraction data yet.</p>
            )}
          </OpsChartCard>
        </div>
      </OpsSection>

      {/* Confidence distribution + failure reasons */}
      <OpsSection title="Quality">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <OpsChartCard title="Confidence distribution" subtitle="How sure the parser was" isDemo={isDemo}>
            {isDemo ? (
              <HBars
                data={[
                  { name: "High", value: 64 },
                  { name: "Medium", value: 22 },
                  { name: "Low", value: 9 },
                  { name: "None", value: 5 },
                ]}
                tone="accent"
              />
            ) : d.confidenceDist.length > 0 ? (
              <HBars data={d.confidenceDist} tone="accent" />
            ) : (
              <p className="py-6 text-center text-xs text-silver">No confidence recorded yet.</p>
            )}
          </OpsChartCard>

          <OpsChartCard title="Most common failure reasons" subtitle="By error code" isDemo={isDemo}>
            {failureReasons.length > 0 ? (
              <HBars data={failureReasons} tone="up" />
            ) : (
              <p className="py-6 text-center text-xs text-down">No failures recorded. Steady and quiet.</p>
            )}
          </OpsChartCard>
        </div>
      </OpsSection>

      {/* Domain health: top + failing */}
      <OpsSection
        title="Domain health"
        description="Per-domain success, confidence, and duration across recent attempts."
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div>
            <h3 className="mb-2 text-xs font-medium text-slate">Healthiest domains</h3>
            {isDemo ? (
              <DemoDomainCard
                rows={[
                  { name: "store.apple.com", value: 99, display: "99%" },
                  { name: "www.bestbuy.com", value: 96, display: "96%" },
                  { name: "www.target.com", value: 94, display: "94%" },
                ]}
              />
            ) : (
              <OpsDataTable
                columns={domainColumns({ showActions: false })}
                rows={d.topDomains}
                getRowKey={(r) => r.domain}
                empty={<OpsEmptyState description="No domain data yet." />}
              />
            )}
          </div>
          <div>
            <h3 className="mb-2 text-xs font-medium text-slate">Most failures</h3>
            {isDemo ? (
              <DemoDomainCard
                rows={[
                  { name: "deals.example-tech.io", value: 18, display: "18 failed" },
                  { name: "shop.example-furniture.com", value: 11, display: "11 failed" },
                ]}
                tone="up"
              />
            ) : (
              <OpsDataTable
                columns={domainColumns({ showActions: true })}
                rows={d.failingDomains}
                getRowKey={(r) => r.domain}
                empty={
                  <OpsEmptyState
                    icon={<CheckCircle2 size={20} />}
                    title="No failing domains"
                    description="Every domain with recent attempts is parsing cleanly."
                  />
                }
              />
            )}
          </div>
        </div>
      </OpsSection>

      {/* Domains needing adapters + slow domains */}
      <OpsSection title="Needs attention">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <OpsChartCard
            title="Domains needing adapters"
            subtitle="Low success rate with real volume (under 70%)"
            isDemo={isDemo}
            action={<PlugZap size={15} className="text-silver" />}
          >
            {isDemo ? (
              <HBars data={demoNeedsAdapter} tone="warn" />
            ) : d.needsAdapter.length > 0 ? (
              <HBars
                data={d.needsAdapter.map((dh) => ({
                  name: dh.domain,
                  value: dh.successRate,
                  display: pct(dh.successRate, 0),
                }))}
                tone="warn"
              />
            ) : (
              <p className="py-6 text-center text-xs text-down">
                No domains are struggling. Nothing needs an adapter right now.
              </p>
            )}
          </OpsChartCard>

          <OpsChartCard
            title="Slowest domains"
            subtitle="Highest average parse duration"
            isDemo={isDemo}
            action={<TimerReset size={15} className="text-silver" />}
          >
            {isDemo ? (
              <HBars
                data={[
                  { name: "shop.example-furniture.com", value: 4200, display: "4.2s" },
                  { name: "store.example-outdoors.co", value: 2800, display: "2.8s" },
                  { name: "deals.example-tech.io", value: 1900, display: "1.9s" },
                ]}
                tone="slate"
              />
            ) : d.slowDomains.length > 0 ? (
              <HBars
                data={d.slowDomains.map((dh) => ({
                  name: dh.domain,
                  value: dh.avgDurationMs ?? 0,
                  display: duration(dh.avgDurationMs),
                }))}
                tone="slate"
              />
            ) : (
              <p className="py-6 text-center text-xs text-silver">No duration data yet.</p>
            )}
          </OpsChartCard>
        </div>
      </OpsSection>

      {/* Watchlisted domains */}
      <OpsSection
        title="Watchlisted domains"
        description="Domains flagged for manual review. Watchlisting and notes are operator context only."
      >
        {watchlist.domains.length > 0 ? (
          <GlassCard className="p-5">
            <ul className="flex flex-wrap gap-2">
              {watchlist.domains.map((dom) => (
                <li key={dom}>
                  <Pill tone="warn" dot icon={<Eye size={11} />} className="font-mono text-[0.75rem]">
                    {dom}
                  </Pill>
                  {watchlist.notes[dom] && (
                    <span className="ml-2 text-xs text-slate">{truncate(watchlist.notes[dom], 80)}</span>
                  )}
                </li>
              ))}
            </ul>
          </GlassCard>
        ) : (
          <OpsEmptyState
            icon={<Eye size={20} />}
            title="No domains on the watchlist"
            description={
              canMutate
                ? "Flag a domain from the recent attempts table to keep an eye on it."
                : "Nothing is flagged for review."
            }
          />
        )}
      </OpsSection>

      {/* Recent parse attempts */}
      <OpsSection
        title="Recent parse attempts"
        description="The latest attempts logged by the parser."
        actions={canRetry ? <span className="text-xs text-silver">Queue a retry below</span> : undefined}
      >
        {canRetry && (
          <GlassCard className="mb-3 p-4">
            <RetryUrlForm retryParse={retryParse} canRetry={canRetry} />
          </GlassCard>
        )}
        {isDemo ? (
          <OpsEmptyState
            icon={<ScanLine size={20} />}
            title="No parse attempts yet"
            description="Once the parser starts reading product URLs, each attempt shows up here with its status, confidence, source, and duration."
          />
        ) : (
          <OpsDataTable
            columns={recentColumns}
            rows={d.recent}
            getRowKey={(r) => r.id}
            empty={<OpsEmptyState description="No recent parse attempts." />}
          />
        )}
      </OpsSection>
    </>
  );
}

/** Compact demo domain card (clearly labelled) for the empty state. */
function DemoDomainCard({
  rows,
  tone = "down",
}: {
  rows: NamedValue[];
  tone?: "down" | "up" | "warn" | "slate" | "accent";
}) {
  return (
    <GlassCard className="p-5">
      <div className="mb-3">
        <DemoBadge />
      </div>
      <HBars data={rows} tone={tone} />
    </GlassCard>
  );
}
