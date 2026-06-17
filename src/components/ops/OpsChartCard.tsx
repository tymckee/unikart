import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";
import { DemoBadge } from "./DemoBadge";

/** Card wrapper for a chart with a title, optional value/legend, demo label. */
export function OpsChartCard({
  title,
  subtitle,
  value,
  action,
  isDemo,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  action?: React.ReactNode;
  isDemo?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <GlassCard className={cn("flex flex-col p-5", className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
            {isDemo && <DemoBadge />}
          </div>
          {subtitle && <p className="mt-0.5 text-xs text-slate">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-3">
          {value && (
            <span className="text-lg font-semibold tabular-nums tracking-tight text-ink">
              {value}
            </span>
          )}
          {action}
        </div>
      </div>
      <div className="mt-auto">{children}</div>
    </GlassCard>
  );
}
