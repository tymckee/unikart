import { cn } from "@/lib/utils";
import { WheelLogo } from "@/components/brand/WheelLogo";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Calm, centered empty state with a quiet wheel motif. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-white/50 px-6 py-16 text-center",
        className,
      )}
    >
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-canvas text-silver">
        {icon ?? <WheelLogo size={28} className="text-titanium" />}
      </div>
      <h3 className="text-balance text-base font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-pretty text-sm text-slate">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
