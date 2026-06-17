import { Activity, AlertTriangle, Timer, ListChecks } from "lucide-react";
import { OpsPageHeader, OpsSection } from "@/components/ops/OpsPageHeader";
import { OpsMetricCard } from "@/components/ops/OpsMetricCard";
import { OpsChartCard } from "@/components/ops/OpsChartCard";
import { Sparkline } from "@/components/ops/Charts";
import { OpsDataTable, type OpsColumn } from "@/components/ops/OpsDataTable";
import { OpsFilterBar } from "@/components/ops/OpsFilterBar";
import { OpsStatusPill } from "@/components/ops/OpsStatusPill";
import { OpsEmptyState } from "@/components/ops/OpsEmptyState";
import { JobRowActions, RunManualCheck } from "@/components/ops/jobs/JobActions";
import { getOpsViewer } from "@/lib/ops/viewer";
import { can } from "@/lib/ops/permissions";
import { getJobs, getJobStats, type JobRunView } from "@/lib/ops/data/jobs";
import { retryJob, cancelJob, runManualCheck } from "@/lib/ops/actions/jobs";
import { readListParams, makeSortHref, makePageHref } from "@/lib/ops/data/common";
import { dateTime, duration, num, pct } from "@/lib/ops/format";
import { demoSeries } from "@/lib/ops/metrics";

export const dynamic = "force-dynamic";

const JOB_TYPE_LABELS: Record<string, string> = {
  price_check: "Price check",
  stock_check: "Stock check",
  parser: "Parser",
  notification: "Notification",
  cleanup: "Cleanup",
  billing_sync: "Billing sync",
  email: "Email",
};

const TYPE_FILTER = [
  { value: "price_check", label: "Price check" },
  { value: "stock_check", label: "Stock check" },
  { value: "parser", label: "Parser" },
  { value: "notification", label: "Notification" },
  { value: "cleanup", label: "Cleanup" },
  { value: "billing_sync", label: "Billing sync" },
  { value: "email", label: "Email" },
];

const STATUS_FILTER = [
  { value: "queued", label: "Queued" },
  { value: "running", label: "Running" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
  { value: "canceled", label: "Canceled" },
];

export default async function OpsJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const viewer = await getOpsViewer();
  const canMutate = can(viewer, "jobs.mutate");

  const lp = readListParams(sp, {
    defaultSort: { key: "createdAt", dir: "desc" },
    sortableKeys: ["createdAt", "startedAt", "durationMs", "itemsProcessed", "itemsFailed"],
    pageSize: 25,
  });

  const [stats, { rows, total }] = await Promise.all([getJobStats(), getJobs(lp)]);

  // Honesty: when there's no real JobRun data, the trend is a clearly-labelled
  // demo series (carrying isDemo through to OpsChartCard's badge).
  const trend = stats.isDemo ? demoSeries("jobs-duration", 14, 850, 600) : stats.durationTrend;
  const failureTone = stats.failureRate7d >= 10 ? "bad" : stats.failureRate7d >= 3 ? "warn" : "good";

  const columns: OpsColumn<JobRunView>[] = [
    {
      key: "jobType",
      header: "Job",
      render: (r) => (
        <span className="font-medium text-ink">{JOB_TYPE_LABELS[r.jobType] ?? r.jobType}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <OpsStatusPill status={r.status} />,
    },
    {
      key: "startedAt",
      header: "Started",
      sortable: true,
      render: (r) => (
        <span className="tabular-nums text-slate">{dateTime(r.startedAt ?? r.createdAt)}</span>
      ),
    },
    {
      key: "durationMs",
      header: "Duration",
      sortable: true,
      align: "right",
      render: (r) => <span className="tabular-nums text-slate">{duration(r.durationMs)}</span>,
    },
    {
      key: "itemsProcessed",
      header: "Processed",
      sortable: true,
      align: "right",
      render: (r) => <span className="tabular-nums text-ink">{num(r.itemsProcessed)}</span>,
    },
    {
      key: "itemsSucceeded",
      header: "Succeeded",
      align: "right",
      render: (r) => (
        <span className="tabular-nums text-down">{num(r.itemsSucceeded)}</span>
      ),
    },
    {
      key: "itemsFailed",
      header: "Failed",
      sortable: true,
      align: "right",
      render: (r) => (
        <span className={"tabular-nums " + (r.itemsFailed > 0 ? "text-up" : "text-silver")}>
          {num(r.itemsFailed)}
        </span>
      ),
    },
    {
      key: "errorCode",
      header: "Error",
      render: (r) =>
        r.errorCode ? (
          <span className="font-mono text-xs text-up">{r.errorCode}</span>
        ) : (
          <span className="text-silver">—</span>
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      action: true,
      render: (r) => (
        <JobRowActions
          job={r}
          canMutate={canMutate}
          retryJob={retryJob}
          cancelJob={cancelJob}
        />
      ),
    },
  ];

  return (
    <>
      <OpsPageHeader
        title="Jobs"
        description="Background work — price and stock checks, parsing, notifications, cleanup, and billing sync."
        actions={canMutate ? <RunManualCheck runManualCheck={runManualCheck} /> : undefined}
      />

      <OpsSection title="Last 7 days">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <OpsMetricCard
            label="Runs (24h)"
            value={num(stats.runs24h)}
            hint="Started in the last day"
            icon={<Activity size={16} />}
            isDemo={stats.isDemo}
          />
          <OpsMetricCard
            label="Runs (7d)"
            value={num(stats.runs7d)}
            icon={<ListChecks size={16} />}
            isDemo={stats.isDemo}
          />
          <OpsMetricCard
            label="Failure rate (7d)"
            value={stats.isDemo ? "—" : pct(stats.failureRate7d)}
            hint="Failed vs. completed runs"
            tone={failureTone}
            icon={<AlertTriangle size={16} />}
            isDemo={stats.isDemo}
          />
          <OpsMetricCard
            label="Avg duration (7d)"
            value={duration(stats.avgDurationMs7d)}
            icon={<Timer size={16} />}
            isDemo={stats.isDemo}
          />
        </div>
      </OpsSection>

      <OpsSection>
        <OpsChartCard
          title="Average duration"
          subtitle="Per-day mean run time, last 14 days"
          isDemo={stats.isDemo}
        >
          <Sparkline
            data={trend}
            tone="accent"
            height={64}
            ariaLabel="Average job-run duration per day over the last 14 days"
          />
        </OpsChartCard>
      </OpsSection>

      <OpsSection title="Recent runs">
        <OpsFilterBar
          searchPlaceholder="Search job type or error…"
          filters={[
            { key: "jobType", label: "Type", options: TYPE_FILTER },
            { key: "status", label: "Status", options: STATUS_FILTER },
          ]}
        />
        <OpsDataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.id}
          sort={lp.sort ?? undefined}
          sortHref={(k) => makeSortHref("/ops/jobs", lp.params, lp.sort, k)}
          pagination={{
            page: lp.page,
            pageSize: lp.pageSize,
            total,
            hrefForPage: (p) => makePageHref("/ops/jobs", lp.params, p),
          }}
          empty={
            <OpsEmptyState
              title="No job runs yet"
              description="Background runs will appear here as the workers record them."
            />
          }
        />
      </OpsSection>
    </>
  );
}
