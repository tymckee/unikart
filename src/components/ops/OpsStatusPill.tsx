import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils";

type PillTone = "neutral" | "ink" | "accent" | "down" | "up" | "warn" | "outline";

/**
 * Status chip with a calm colour mapping shared across Ops. Pass any status
 * string; unknown values fall back to neutral. Colours never alarm — "down" is
 * the quiet green (good), "up" the muted red (attention), per the brand.
 */
const STATUS_TONE: Record<string, PillTone> = {
  // health / generic
  operational: "down",
  ok: "down",
  healthy: "down",
  active: "down",
  live: "down",
  succeeded: "down",
  success: "down",
  resolved: "down",
  completed: "down",
  enabled: "down",
  delivered: "down",
  in_stock: "down",
  paid: "down",
  trialing: "accent",
  degraded: "warn",
  partial: "warn",
  pending: "warn",
  queued: "warn",
  running: "accent",
  open: "accent",
  low_stock: "warn",
  past_due: "warn",
  needs_review: "warn",
  watchlisted: "warn",
  // bad
  down: "up",
  failed: "up",
  error: "up",
  disabled: "up",
  canceled: "up",
  cancelled: "up",
  out_of_stock: "up",
  closed: "neutral",
  archived: "neutral",
  released: "neutral",
  unknown: "neutral",
  none: "neutral",
};

function labelize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function OpsStatusPill({
  status,
  label,
  dot = true,
  className,
}: {
  status: string | null | undefined;
  label?: string;
  dot?: boolean;
  className?: string;
}) {
  const key = (status ?? "unknown").toLowerCase();
  const tone = STATUS_TONE[key] ?? "neutral";
  return (
    <Pill tone={tone} dot={dot} className={cn("capitalize", className)}>
      {label ?? labelize(key)}
    </Pill>
  );
}
