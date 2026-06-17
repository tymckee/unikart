import { Flag } from "lucide-react";
import { OpsPageHeader, OpsSection } from "@/components/ops/OpsPageHeader";
import { OpsMetricCard } from "@/components/ops/OpsMetricCard";
import { OpsEmptyState } from "@/components/ops/OpsEmptyState";
import { GlassCard } from "@/components/ui/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { FlagControls } from "@/components/ops/flags/FlagControls";
import { getFlags } from "@/lib/ops/data/feature-flags";
import {
  toggleFlag,
  setRollout,
  setAllowlist,
  setDenylist,
} from "@/lib/ops/actions/feature-flags";
import { getOpsViewer } from "@/lib/ops/viewer";
import { can } from "@/lib/ops/permissions";
import { num } from "@/lib/ops/format";

export const dynamic = "force-dynamic";

export default async function FeatureFlagsPage() {
  const viewer = await getOpsViewer();
  const canMutate = can(viewer, "featureFlags.mutate");

  const flags = await getFlags();

  // The bound server actions, shaped for FlagControls. Passing them from this
  // server component lets the client component call them directly as props.
  const actions = {
    toggle: toggleFlag,
    setRollout,
    setAllowlist,
    setDenylist,
  };

  const maintenance = flags.find((f) => f.isMaintenance);
  const rest = flags.filter((f) => !f.isMaintenance);

  const enabledCount = flags.filter((f) => f.enabled).length;
  const partialRollout = rest.filter(
    (f) => f.enabled && f.rolloutPercent > 0 && f.rolloutPercent < 100,
  ).length;

  return (
    <>
      <OpsPageHeader
        title="Feature flags"
        description="Turn features on or off, roll them out gradually, and keep allow or deny lists per flag. Changes take effect immediately and are recorded in the audit log."
        actions={
          !canMutate ? (
            <Pill tone="outline">Read-only</Pill>
          ) : undefined
        }
      />

      {flags.length === 0 ? (
        <OpsEmptyState
          icon={<Flag size={20} />}
          title="No feature flags yet"
          description="Flags appear here once they're configured. Nothing to show right now."
        />
      ) : (
        <>
          {/* Summary metrics — all from real flag rows. */}
          <OpsSection>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <OpsMetricCard
                label="Flags"
                value={num(flags.length)}
                hint="Total configured"
                icon={<Flag size={16} />}
              />
              <OpsMetricCard
                label="Enabled"
                value={num(enabledCount)}
                hint={num(flags.length - enabledCount) + " off"}
                tone="accent"
              />
              <OpsMetricCard
                label="Partial rollout"
                value={num(partialRollout)}
                hint="Enabled, between 1–99%"
                tone={partialRollout > 0 ? "warn" : "neutral"}
              />
            </div>
          </OpsSection>

          {/* Emergency kill switch — surfaced on its own, ahead of everything. */}
          {maintenance && (
            <OpsSection
              title="Emergency controls"
              description="The maintenance kill switch. Use only during an incident."
            >
              <FlagControls
                flag={maintenance}
                canMutate={canMutate}
                actions={actions}
              />
            </OpsSection>
          )}

          {/* All other flags. */}
          <OpsSection title="Features">
            {rest.length === 0 ? (
              <GlassCard className="px-5 py-6">
                <p className="text-sm text-slate">No other flags configured.</p>
              </GlassCard>
            ) : (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {rest.map((flag) => (
                  <FlagControls
                    key={flag.key}
                    flag={flag}
                    canMutate={canMutate}
                    actions={actions}
                  />
                ))}
              </div>
            )}
          </OpsSection>
        </>
      )}
    </>
  );
}
