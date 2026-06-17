import { cn, svgRound } from "@/lib/utils";

interface WheelLogoProps {
  size?: number;
  spokes?: number;
  className?: string;
  /** Continuous slow rotation (used in hero / loading contexts). */
  spinning?: boolean;
  /** Tint the hub with the accent color. */
  accentHub?: boolean;
  title?: string;
}

/**
 * UniKart mark — a thin-lined bike wheel / radial cart symbol.
 * Hub · spokes · rim. Monochrome (currentColor) by default.
 */
export function WheelLogo({
  size = 28,
  spokes = 12,
  className,
  spinning = false,
  accentHub = false,
  title = "UniKart",
}: WheelLogoProps) {
  const c = 50;
  const spokeInner = 13;
  const spokeOuter = 38.5;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={title}
      className={cn("shrink-0", className)}
      fill="none"
    >
      {/* Rim — double hairline for a "tire" feel */}
      <circle cx={c} cy={c} r="46" stroke="currentColor" strokeWidth="2" />
      <circle
        cx={c}
        cy={c}
        r="40"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.55"
      />

      {/* Spokes */}
      <g
        opacity="0.8"
        className={cn(spinning && "origin-center animate-wheel-slow")}
        style={{ transformOrigin: "50px 50px" }}
      >
        {Array.from({ length: spokes }).map((_, i) => {
          const a = (i / spokes) * Math.PI * 2 - Math.PI / 2;
          return (
            <line
              key={i}
              x1={svgRound(c + spokeInner * Math.cos(a))}
              y1={svgRound(c + spokeInner * Math.sin(a))}
              x2={svgRound(c + spokeOuter * Math.cos(a))}
              y2={svgRound(c + spokeOuter * Math.sin(a))}
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
            />
          );
        })}
      </g>

      {/* Hub */}
      <circle
        cx={c}
        cy={c}
        r="10"
        stroke="currentColor"
        strokeWidth="2"
        className={accentHub ? "text-accent" : undefined}
      />
      <circle
        cx={c}
        cy={c}
        r="3.2"
        fill="currentColor"
        className={accentHub ? "text-accent" : undefined}
      />
    </svg>
  );
}

/** Wheel mark + wordmark, for headers and the landing nav. */
export function Wordmark({
  size = 26,
  className,
  textClassName,
}: {
  size?: number;
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <WheelLogo size={size} className="text-ink" />
      <span
        className={cn(
          "text-[1.05rem] font-semibold tracking-tight text-ink",
          textClassName,
        )}
      >
        Uni<span className="text-slate">Kart</span>
      </span>
    </span>
  );
}
