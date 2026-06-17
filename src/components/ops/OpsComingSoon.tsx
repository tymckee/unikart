import { Hammer } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

/**
 * Clean "coming next" panel for sections that are intentionally not built yet.
 * Never a broken page — states clearly what's planned and what works today.
 */
export function OpsComingSoon({
  title = "Coming next",
  description,
  planned,
}: {
  title?: string;
  description?: string;
  planned?: string[];
}) {
  return (
    <GlassCard className="p-6">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-canvas text-slate">
          <Hammer size={16} />
        </span>
        <h3 className="text-sm font-semibold tracking-tight text-ink">{title}</h3>
      </div>
      {description && <p className="mt-3 max-w-prose text-sm text-slate text-pretty">{description}</p>}
      {planned && planned.length > 0 && (
        <ul className="mt-4 space-y-2">
          {planned.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-titanium" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </GlassCard>
  );
}
