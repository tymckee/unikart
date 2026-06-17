import { cn, svgRound } from "@/lib/utils";

interface WheelLoaderProps {
  size?: number;
  spokes?: number;
  className?: string;
  label?: string;
  sublabel?: string;
}

/**
 * A spinning thin-line wheel — shown while a product URL is parsed.
 * Spokes fade around the rim like a calm comet, then the wheel turns.
 */
export function WheelLoader({
  size = 56,
  spokes = 12,
  className,
  label,
  sublabel,
}: WheelLoaderProps) {
  const c = 50;
  const inner = 16;
  const outer = 40;

  return (
    <div
      className={cn("flex flex-col items-center justify-center gap-4", className)}
      role="status"
      aria-live="polite"
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        fill="none"
        aria-hidden="true"
      >
        <circle cx={c} cy={c} r="46" stroke="var(--color-line)" strokeWidth="2" />
        <g
          className="animate-wheel"
          style={{ transformOrigin: "50px 50px" }}
        >
          {Array.from({ length: spokes }).map((_, i) => {
            const a = (i / spokes) * Math.PI * 2 - Math.PI / 2;
            const opacity = 0.12 + (i / (spokes - 1)) * 0.88;
            return (
              <line
                key={i}
                x1={svgRound(c + inner * Math.cos(a))}
                y1={svgRound(c + inner * Math.sin(a))}
                x2={svgRound(c + outer * Math.cos(a))}
                y2={svgRound(c + outer * Math.sin(a))}
                stroke="var(--color-accent)"
                strokeWidth="3"
                strokeLinecap="round"
                opacity={opacity}
              />
            );
          })}
          <circle cx={c} cy={c} r="9" stroke="var(--color-accent)" strokeWidth="3" opacity="0.9" />
        </g>
      </svg>
      {label && (
        <div className="text-center">
          <p className="text-sm font-medium text-ink">{label}</p>
          {sublabel && <p className="mt-0.5 text-xs text-slate">{sublabel}</p>}
        </div>
      )}
    </div>
  );
}

/** Small inline variant for buttons and chips. */
export function WheelSpinner({
  size = 18,
  className,
}: {
  size?: number;
  className?: string;
}) {
  const c = 50;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      className={cn("animate-wheel", className)}
      style={{ transformOrigin: "50px 50px" }}
      aria-hidden="true"
    >
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        const opacity = 0.15 + (i / 7) * 0.85;
        return (
          <line
            key={i}
            x1={svgRound(c + 22 * Math.cos(a))}
            y1={svgRound(c + 22 * Math.sin(a))}
            x2={svgRound(c + 42 * Math.cos(a))}
            y2={svgRound(c + 42 * Math.sin(a))}
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            opacity={opacity}
          />
        );
      })}
    </svg>
  );
}
