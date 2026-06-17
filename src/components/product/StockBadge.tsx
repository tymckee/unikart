import { cn } from "@/lib/utils";
import { Pill } from "@/components/ui/Pill";
import type { Availability, MetadataConfidence } from "@/lib/types";

const STOCK: Record<
  Availability,
  { label: string; tone: "down" | "warn" | "up" | "accent" | "neutral" }
> = {
  in_stock: { label: "In stock", tone: "down" },
  low_stock: { label: "Low stock", tone: "warn" },
  out_of_stock: { label: "Out of stock", tone: "up" },
  preorder: { label: "Preorder", tone: "accent" },
  unknown: { label: "Unknown", tone: "neutral" },
};

export function StockBadge({
  availability,
  className,
}: {
  availability: Availability;
  className?: string;
}) {
  const s = STOCK[availability];
  return (
    <Pill tone={s.tone} dot className={className}>
      {s.label}
    </Pill>
  );
}

const CONFIDENCE: Record<
  MetadataConfidence,
  { label: string; bars: number; color: string }
> = {
  high: { label: "High confidence", bars: 3, color: "var(--color-down)" },
  medium: { label: "Medium confidence", bars: 2, color: "var(--color-warn)" },
  low: { label: "Low confidence", bars: 1, color: "var(--color-silver)" },
};

/** Small signal-bar meter for scraped-metadata confidence. */
export function ConfidenceMeter({
  confidence,
  showLabel = false,
  className,
}: {
  confidence: MetadataConfidence;
  showLabel?: boolean;
  className?: string;
}) {
  const c = CONFIDENCE[confidence];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      title={c.label}
    >
      <span className="flex items-end gap-0.5" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1 rounded-full"
            style={{
              height: `${5 + i * 3}px`,
              background: i < c.bars ? c.color : "var(--color-fog)",
            }}
          />
        ))}
      </span>
      {showLabel && (
        <span className="text-[0.6875rem] text-slate">{c.label}</span>
      )}
      <span className="sr-only">{c.label}</span>
    </span>
  );
}
