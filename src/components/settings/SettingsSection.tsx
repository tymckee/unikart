import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  title: string;
  description?: string;
  id?: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingsSection({
  title,
  description,
  id,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section id={id} className={cn("scroll-mt-24", className)}>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-slate">{description}</p>
        )}
      </div>
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-soft">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  label,
  description,
  control,
  className,
}: {
  label: string;
  description?: string;
  control?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b border-line px-5 py-4 last:border-b-0",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-slate">{description}</p>
        )}
      </div>
      {control && <div className="shrink-0">{control}</div>}
    </div>
  );
}
