import { formatPrice } from "@/lib/utils";
import type { PriceSnapshot } from "@/lib/types";

interface PriceHistoryChartProps {
  history: PriceSnapshot[];
  currency?: string;
  targetPrice?: number | null;
  height?: number;
}

/** Lightweight, dependency-free SVG price chart. */
export function PriceHistoryChart({
  history,
  currency = "USD",
  targetPrice,
  height = 220,
}: PriceHistoryChartProps) {
  if (history.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-line text-sm text-slate">
        Not enough history yet — tracking has just begun.
      </div>
    );
  }

  const W = 600;
  const H = height;
  const padX = 14;
  const padY = 22;

  const prices = history.map((h) => h.price);
  const considered = targetPrice ? [...prices, targetPrice] : prices;
  const min = Math.min(...considered);
  const max = Math.max(...considered);
  const range = max - min || 1;

  const x = (i: number) =>
    padX + (i / (history.length - 1)) * (W - padX * 2);
  const y = (p: number) =>
    padY + (1 - (p - min) / range) * (H - padY * 2);

  const linePoints = history.map((h, i) => `${x(i)},${y(h.price)}`).join(" ");
  const areaPath = `M ${x(0)},${H - padY} L ${history
    .map((h, i) => `${x(i)},${y(h.price)}`)
    .join(" L ")} L ${x(history.length - 1)},${H - padY} Z`;

  const lowIdx = prices.indexOf(min);
  const lastIdx = history.length - 1;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Price history"
      >
        <defs>
          <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={padX}
            x2={W - padX}
            y1={padY + t * (H - padY * 2)}
            y2={padY + t * (H - padY * 2)}
            stroke="var(--color-line)"
            strokeWidth="1"
          />
        ))}

        {/* target line */}
        {targetPrice != null && (
          <line
            x1={padX}
            x2={W - padX}
            y1={y(targetPrice)}
            y2={y(targetPrice)}
            stroke="var(--color-down)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            opacity="0.8"
          />
        )}

        <path d={areaPath} fill="url(#priceFill)" />
        <polyline
          points={linePoints}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* lowest marker */}
        <circle cx={x(lowIdx)} cy={y(min)} r="4" fill="var(--color-down)" />
        {/* current marker */}
        <circle
          cx={x(lastIdx)}
          cy={y(history[lastIdx].price)}
          r="5"
          fill="var(--color-accent)"
          stroke="#fff"
          strokeWidth="2"
        />
      </svg>

      <div className="mt-2 flex items-center justify-between text-xs text-slate">
        <span>
          Low{" "}
          <span className="font-medium text-down">{formatPrice(min, currency)}</span>
        </span>
        {targetPrice != null && (
          <span>
            Target{" "}
            <span className="font-medium text-ink">
              {formatPrice(targetPrice, currency)}
            </span>
          </span>
        )}
        <span>
          High{" "}
          <span className="font-medium text-ink">{formatPrice(max, currency)}</span>
        </span>
      </div>
    </div>
  );
}
