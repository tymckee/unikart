import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div>
        {eyebrow && (
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-accent">
            {eyebrow}
          </p>
        )}
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 max-w-xl text-pretty text-sm text-slate">
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
