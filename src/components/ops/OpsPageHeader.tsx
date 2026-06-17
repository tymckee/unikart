import { cn } from "@/lib/utils";

/** Standard Ops page heading: title, supporting line, and an actions slot. */
export function OpsPageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-slate text-pretty">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** A titled section block within a page. */
export function OpsSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-8", className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            {title && (
              <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
            )}
            {description && <p className="mt-0.5 text-xs text-slate">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}
