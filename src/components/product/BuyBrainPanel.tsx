import { Brain } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";
import type { BuyBrainResult } from "@/lib/buy-brain";
import { WheelRing } from "@/components/brand/WheelRing";
import { Pill } from "@/components/ui/Pill";

const VERDICT: Record<
  BuyBrainResult["verdict"],
  { label: string; tone: "down" | "warn" | "accent"; ring: string }
> = {
  buy: { label: "Buy", tone: "down", ring: "stroke-down" },
  wait: { label: "Wait", tone: "warn", ring: "stroke-warn" },
  watch: { label: "Watch", tone: "accent", ring: "stroke-accent" },
};

interface BuyBrainPanelProps {
  result: BuyBrainResult;
  factors?: string[];
  compact?: boolean;
  className?: string;
}

/** "Buy Brain" — calm, deterministic Buy / Wait / Watch guidance. */
export function BuyBrainPanel({
  result,
  factors = [],
  compact = false,
  className,
}: BuyBrainPanelProps) {
  const v = VERDICT[result.verdict];

  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-white p-5 shadow-soft",
        className,
      )}
    >
      <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate">
        <Brain size={14} className="text-accent" />
        Buy Brain
      </div>

      <div className="flex items-center gap-4">
        <WheelRing
          progress={result.confidence}
          size={compact ? 72 : 92}
          stroke={7}
          progressClassName={v.ring}
        >
          <span className="text-[0.8125rem] font-semibold text-ink">
            {v.label}
          </span>
        </WheelRing>

        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink">{result.headline}</p>
          <p className="mt-1 text-pretty text-sm text-slate">{result.reason}</p>
          <p className="mt-2 text-[0.6875rem] text-silver">
            {Math.round(result.confidence * 100)}% confidence · not financial
            advice
          </p>
        </div>
      </div>

      {factors.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
          {factors.map((f) => (
            <Pill key={f} tone="neutral">
              {f}
            </Pill>
          ))}
        </div>
      )}
    </div>
  );
}

/** Build human factor chips from a product for the Buy Brain panel. */
export function buyBrainFactors(p: {
  currentPrice: number | null;
  lowestPrice?: number | null;
  availability: string;
  currency: string;
  targetPrice?: number | null;
}): string[] {
  const out: string[] = [];
  out.push(
    p.availability === "in_stock"
      ? "In stock"
      : p.availability === "low_stock"
        ? "Low stock"
        : p.availability === "out_of_stock"
          ? "Out of stock"
          : "Stock unknown",
  );
  if (p.currentPrice != null && p.lowestPrice != null) {
    const overLow = p.currentPrice - p.lowestPrice;
    out.push(
      overLow <= 0.01
        ? "At all-time low"
        : `${formatPrice(overLow, p.currency)} above low`,
    );
  }
  if (p.targetPrice != null && p.currentPrice != null) {
    const gap = p.currentPrice - p.targetPrice;
    out.push(
      gap <= 0
        ? "Target reached"
        : `${formatPrice(gap, p.currency)} to target`,
    );
  }
  return out;
}
