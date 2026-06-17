import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";
import { DemoBadge } from "./DemoBadge";
import type { MetricDelta, MetricTone } from "@/lib/ops/types";

const TONE_TEXT: Record<MetricTone, string> = {
  neutral: "text-ink",
  good: "text-down",
  warn: "text-warn",
  bad: "text-up",
  accent: "text-accent-ink",
};

function DeltaChip({ delta }: { delta: MetricDelta }) {
  if (delta.direction === "flat") {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-silver">
        <Minus size={12} /> 0%
      </span>
    );
  }
  const upIsGood = delta.upIsGood ?? true;
  const isGood = delta.direction === "up" ? upIsGood : !upIsGood;
  const Icon = delta.direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        isGood ? "text-down" : "text-up",
      )}
    >
      <Icon size={12} />
      {Math.abs(delta.pct)}%
    </span>
  );
}

/** A single dashboard metric. Calm, generous, tabular numerals. */
export function OpsMetricCard({
  label,
  value,
  hint,
  tone = "neutral",
  delta,
  isDemo,
  icon,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: MetricTone;
  delta?: MetricDelta | null;
  isDemo?: boolean;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <GlassCard className={cn("p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate">{label}</p>
        {icon && <span className="text-silver">{icon}</span>}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className={cn("text-2xl font-semibold tracking-tight tabular-nums", TONE_TEXT[tone])}>
          {value}
        </span>
        {delta && <DeltaChip delta={delta} />}
      </div>
      <div className="mt-1 flex items-center gap-2">
        {hint && <p className="text-xs text-silver">{hint}</p>}
        {isDemo && <DemoBadge />}
      </div>
    </GlassCard>
  );
}
