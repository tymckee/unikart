import { cn, svgRound } from "@/lib/utils";

interface WheelRingProps {
  /** 0–1 completion. */
  progress: number;
  size?: number;
  stroke?: number;
  /** Number of spoke ticks around the rim (e.g. one per checkout step). */
  ticks?: number;
  className?: string;
  trackClassName?: string;
  progressClassName?: string;
  children?: React.ReactNode;
}

/**
 * The "Rim" — a progress ring inspired by a wheel, with optional
 * spoke ticks. Used for the Checkout Assistant and stat dials.
 */
export function WheelRing({
  progress,
  size = 120,
  stroke = 8,
  ticks = 0,
  className,
  trackClassName,
  progressClassName,
  children,
}: WheelRingProps) {
  const r = (100 - stroke) / 2;
  const c = 50;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, progress));
  const dash = circumference * clamped;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} fill="none">
        {/* Track */}
        <circle
          cx={c}
          cy={c}
          r={r}
          strokeWidth={stroke}
          className={cn("stroke-fog", trackClassName)}
          strokeLinecap="round"
        />
        {/* Progress arc */}
        <circle
          cx={c}
          cy={c}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${svgRound(dash)} ${svgRound(circumference)}`}
          transform={`rotate(-90 ${c} ${c})`}
          className={cn(
            "stroke-accent transition-[stroke-dasharray] duration-700 ease-out",
            progressClassName,
          )}
        />
        {/* Spoke ticks */}
        {ticks > 0 &&
          Array.from({ length: ticks }).map((_, i) => {
            const a = (i / ticks) * Math.PI * 2 - Math.PI / 2;
            const ri = r - stroke / 2 - 3;
            const ro = r - stroke / 2 - 9;
            return (
              <line
                key={i}
                x1={svgRound(c + ri * Math.cos(a))}
                y1={svgRound(c + ri * Math.sin(a))}
                x2={svgRound(c + ro * Math.cos(a))}
                y2={svgRound(c + ro * Math.sin(a))}
                stroke="var(--color-line)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            );
          })}
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {children}
        </div>
      )}
    </div>
  );
}
