import { AlertTriangle, ExternalLink, Gauge, Timer } from "lucide-react";
import { OpsPageHeader, OpsSection } from "@/components/ops/OpsPageHeader";
import { OpsWheelHealth } from "@/components/ops/OpsWheelHealth";
import { OpsStatusPill } from "@/components/ops/OpsStatusPill";
import { OpsKeyValue } from "@/components/ops/OpsKeyValue";
import { OpsEmptyState } from "@/components/ops/OpsEmptyState";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { getOpsViewer } from "@/lib/ops/viewer";
import { getSystemHealth } from "@/lib/ops/data/system";
import { dateTime, duration } from "@/lib/ops/format";

/**
 * System health — a calm, honest read on every service that keeps UniKart
 * running, rendered through the wheel motif (each service a spoke; the hub
 * reflects the worst current state). Read-only. Real probes where we have them;
 * plainly-stated "—" / "none captured" where a signal genuinely doesn't exist
 * yet — never a fabricated number.
 */
export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  operational: "Operational",
  degraded: "Degraded",
  down: "Down",
  disabled: "Disabled",
  unknown: "Unknown",
};

export default async function OpsSystemPage() {
  await getOpsViewer();
  const d = await getSystemHealth();

  return (
    <>
      <OpsPageHeader
        title="System health"
        description="Each service as a spoke on the wheel — what's running, what's quiet, and anything that needs attention."
        actions={
          <Button href="/api/health" variant="secondary" size="sm">
            Health endpoint
            <ExternalLink size={14} />
          </Button>
        }
      />

      {/* The wheel + overall status */}
      <OpsSection
        title="Services"
        description="The hub reflects the worst current state across all spokes."
        actions={<OpsStatusPill status={d.worstStatus} />}
      >
        <GlassCard className="p-5 sm:p-6">
          <OpsWheelHealth services={d.services} />
        </GlassCard>
      </OpsSection>

      {/* Deploy / runtime details */}
      <OpsSection title="Deploy & runtime">
        <GlassCard className="p-5 sm:p-6">
          <OpsKeyValue
            columns={2}
            items={[
              {
                label: "Environment",
                value: <span className="capitalize">{d.environment}</span>,
              },
              {
                label: "Deploy",
                value: d.commitHash ?? "—",
                mono: true,
              },
              {
                label: "Database latency",
                value: (
                  <span className="tabular-nums">
                    {d.dbLatencyMs != null ? duration(d.dbLatencyMs) : "—"}
                  </span>
                ),
              },
              {
                label: "Uptime",
                value: (
                  <span className="text-silver" title="Process uptime is not tracked in this build">
                    — not tracked
                  </span>
                ),
              },
            ]}
          />
        </GlassCard>
      </OpsSection>

      {/* Recent errors — honest empty state, no fabrication */}
      <OpsSection
        title="Recent errors"
        description="From an application error-capture pipeline, once one is wired."
      >
        <GlassCard className="p-5 sm:p-6">
          {d.recentErrors ? (
            <p className="text-sm text-ink">{d.recentErrors}</p>
          ) : (
            <div className="flex items-center gap-2 text-sm text-slate">
              <OpsStatusPill status="ok" label="None captured" />
              <span className="text-silver">
                No error-capture pipeline is wired in this build, so nothing is reported here.
              </span>
            </div>
          )}
        </GlassCard>
      </OpsSection>

      {/* Recent failed jobs + slow API calls, side by side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <OpsSection
          title="Recent failed jobs"
          description="The last few background runs that ended in failure."
        >
          <GlassCard className="p-5 sm:p-6">
            {d.recentFailedJobs.length === 0 ? (
              <OpsEmptyState
                icon={<AlertTriangle size={20} />}
                title="No failed jobs"
                description="Recent background runs have completed without failures."
              />
            ) : (
              <ul className="divide-y divide-line">
                {d.recentFailedJobs.map((j) => (
                  <li key={j.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{j.jobType}</p>
                      {j.errorCode ? (
                        <p className="truncate font-mono text-xs text-up">{j.errorCode}</p>
                      ) : j.errorMessage ? (
                        <p className="truncate text-xs text-slate">{j.errorMessage}</p>
                      ) : (
                        <p className="text-xs text-silver">No error code recorded</p>
                      )}
                    </div>
                    <span className="shrink-0 tabular-nums text-xs text-silver">
                      {dateTime(j.finishedAt ?? j.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </OpsSection>

        <OpsSection
          title="Slowest API calls"
          description="Top requests by recorded duration, last 7 days."
        >
          <GlassCard className="p-5 sm:p-6">
            {d.slowApiCalls.length === 0 ? (
              <OpsEmptyState
                icon={<Timer size={20} />}
                title="No timing data yet"
                description="Slow requests will appear here once API timing is recorded."
              />
            ) : (
              <ul className="divide-y divide-line">
                {d.slowApiCalls.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs text-ink">
                        <span className="text-slate">{c.method}</span> {c.route}
                      </p>
                      <p className="text-xs text-silver">
                        <span className="tabular-nums">{c.statusCode}</span> · {dateTime(c.createdAt)}
                      </p>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1 tabular-nums text-sm text-ink">
                      <Gauge size={14} className="text-silver" />
                      {duration(c.durationMs)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </OpsSection>
      </div>

      {/* Legend — honest framing of what each state means */}
      <OpsSection>
        <p className="text-xs text-silver">
          {STATUS_LABEL.operational} means a service is running. {STATUS_LABEL.degraded} flags
          reduced reliability. {STATUS_LABEL.disabled} means the integration isn&apos;t configured in
          this environment. {STATUS_LABEL.unknown} means there isn&apos;t enough recent data to judge.
        </p>
      </OpsSection>
    </>
  );
}
