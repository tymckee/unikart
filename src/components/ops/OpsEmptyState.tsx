import { Inbox } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

/** Calm empty state — never salesy, never alarming. */
export function OpsEmptyState({
  title = "Nothing here yet",
  description,
  icon,
  action,
  className,
}: {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <GlassCard className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-canvas text-silver">
        {icon ?? <Inbox size={20} />}
      </div>
      <p className="text-sm font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </GlassCard>
  );
}
