/**
 * UniKart Ops — dependency-free SVG charts.
 *
 * Calm, hairline, restrained — no chart library, no client JS. Pure server
 * components that render an SVG from props. Colours come from the brand CSS
 * variables (@theme in globals.css), so they stay on-palette automatically.
 */
import { svgRound } from "@/lib/utils";
import type { ChartPoint, NamedValue } from "@/lib/ops/types";

type Tone = "accent" | "down" | "up" | "warn" | "ink" | "slate";

const TONE_VAR: Record<Tone, string> = {
  accent: "var(--color-accent)",
  down: "var(--color-down)",
  up: "var(--color-up)",
  warn: "var(--color-warn)",
  ink: "var(--color-ink)",
  slate: "var(--color-slate)",
};

function minMax(values: number[]): [number, number] {
  if (values.length === 0) return [0, 1];
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  return [min, max === min ? min + 1 : max];
}

/** Smooth-ish line with an optional soft area fill. */
export function Sparkline({
  data,
  height = 48,
  tone = "accent",
  showArea = true,
  className,
  ariaLabel,
}: {
  data: ChartPoint[];
  height?: number;
  tone?: Tone;
  showArea?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const W = 100;
  const H = height;
  if (data.length === 0) return <EmptyChart height={H} className={className} />;
  const values = data.map((d) => d.value);
  const [min, max] = minMax(values);
  const n = data.length;
  const x = (i: number) => svgRound((i / Math.max(1, n - 1)) * W);
  const y = (v: number) => svgRound(H - 4 - ((v - min) / (max - min)) * (H - 8));
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(" ");
  const color = TONE_VAR[tone];
  const gid = `spark-${tone}-${n}-${Math.round(max)}`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: "100%", height: H }}
      role="img"
      aria-label={ariaLabel ?? "Trend line"}
    >
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {showArea && (
        <polygon
          points={`0,${H} ${pts} ${W},${H}`}
          fill={`url(#${gid})`}
          stroke="none"
        />
      )}
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Vertical bars (counts per day). */
export function MiniBars({
  data,
  height = 56,
  tone = "accent",
  className,
  ariaLabel,
}: {
  data: ChartPoint[];
  height?: number;
  tone?: Tone;
  className?: string;
  ariaLabel?: string;
}) {
  const H = height;
  if (data.length === 0) return <EmptyChart height={H} className={className} />;
  const [, max] = minMax(data.map((d) => d.value));
  const n = data.length;
  const gap = n > 40 ? 0.5 : 1.5;
  const bw = (100 - gap * (n - 1)) / n;
  const color = TONE_VAR[tone];
  return (
    <svg
      viewBox={`0 0 100 ${H}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: "100%", height: H }}
      role="img"
      aria-label={ariaLabel ?? "Bar chart"}
    >
      {data.map((d, i) => {
        const h = svgRound(Math.max(0.6, (d.value / max) * (H - 4)));
        const x = svgRound(i * (bw + gap));
        return (
          <rect
            key={i}
            x={x}
            y={svgRound(H - h)}
            width={svgRound(bw)}
            height={h}
            rx={svgRound(Math.min(1.2, bw / 2))}
            fill={color}
            opacity={0.85}
          />
        );
      })}
    </svg>
  );
}

/** Stacked success (bottom) vs failure (top) bars. value = ok, value2 = fail. */
export function SuccessFailBars({
  data,
  height = 64,
  className,
  ariaLabel,
}: {
  data: ChartPoint[];
  height?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const H = height;
  if (data.length === 0) return <EmptyChart height={H} className={className} />;
  const totals = data.map((d) => d.value + (d.value2 ?? 0));
  const [, max] = minMax(totals);
  const n = data.length;
  const gap = n > 40 ? 0.5 : 1.4;
  const bw = (100 - gap * (n - 1)) / n;
  return (
    <svg
      viewBox={`0 0 100 ${H}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: "100%", height: H }}
      role="img"
      aria-label={ariaLabel ?? "Success and failure over time"}
    >
      {data.map((d, i) => {
        const ok = d.value;
        const fail = d.value2 ?? 0;
        const total = ok + fail;
        const x = svgRound(i * (bw + gap));
        const fullH = total === 0 ? 0.6 : (total / max) * (H - 4);
        const okH = total === 0 ? 0 : (ok / total) * fullH;
        const failH = fullH - okH;
        return (
          <g key={i}>
            {failH > 0 && (
              <rect
                x={x}
                y={svgRound(H - fullH)}
                width={svgRound(bw)}
                height={svgRound(failH)}
                rx={svgRound(Math.min(1.2, bw / 2))}
                fill={TONE_VAR.up}
                opacity={0.7}
              />
            )}
            <rect
              x={x}
              y={svgRound(H - okH)}
              width={svgRound(bw)}
              height={svgRound(Math.max(0.6, okH))}
              rx={svgRound(Math.min(1.2, bw / 2))}
              fill={TONE_VAR.down}
              opacity={0.85}
            />
          </g>
        );
      })}
    </svg>
  );
}

const DONUT_TONES: Tone[] = ["accent", "down", "warn", "slate", "up", "ink"];

/** Distribution donut (extraction methods, plan mix). */
export function Donut({
  segments,
  size = 120,
  thickness = 14,
  centerLabel,
  centerSub,
}: {
  segments: NamedValue[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerSub?: string;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribution">
        <circle cx={c} cy={c} r={r} fill="none" stroke="var(--color-mist)" strokeWidth={thickness} />
        {total > 0 &&
          segments.map((seg, i) => {
            const frac = seg.value / total;
            const len = svgRound(frac * circ);
            const dash = `${len} ${svgRound(circ - len)}`;
            const el = (
              <circle
                key={i}
                cx={c}
                cy={c}
                r={r}
                fill="none"
                stroke={TONE_VAR[DONUT_TONES[i % DONUT_TONES.length]]}
                strokeWidth={thickness}
                strokeDasharray={dash}
                strokeDashoffset={svgRound(-offset)}
                transform={`rotate(-90 ${c} ${c})`}
                strokeLinecap="butt"
                opacity={0.9}
              />
            );
            offset += len;
            return el;
          })}
        {centerLabel && (
          <text x={c} y={c - 2} textAnchor="middle" className="fill-ink" style={{ fontSize: 18, fontWeight: 600 }}>
            {centerLabel}
          </text>
        )}
        {centerSub && (
          <text x={c} y={c + 14} textAnchor="middle" className="fill-slate" style={{ fontSize: 9 }}>
            {centerSub}
          </text>
        )}
      </svg>
      <ul className="space-y-1.5 text-xs">
        {segments.map((seg, i) => (
          <li key={i} className="flex items-center gap-2 text-slate">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: TONE_VAR[DONUT_TONES[i % DONUT_TONES.length]] }}
            />
            <span className="text-ink">{seg.display ?? seg.name}</span>
            <span className="tabular-nums text-silver">
              {total > 0 ? Math.round((seg.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Horizontal labelled bars (top users / domains / routes). */
export function HBars({ data, tone = "accent" }: { data: NamedValue[]; tone?: Tone }) {
  const [, max] = minMax(data.map((d) => d.value));
  return (
    <ul className="space-y-2.5">
      {data.map((d, i) => (
        <li key={i} className="grid grid-cols-[1fr_auto] items-center gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-xs text-ink">{d.name}</span>
              <span className="shrink-0 tabular-nums text-xs text-slate">
                {d.display ?? d.value}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-mist">
              <div
                className="h-full rounded-full"
                style={{ width: `${(d.value / max) * 100}%`, background: TONE_VAR[tone], opacity: 0.85 }}
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyChart({ height, className }: { height: number; className?: string }) {
  return (
    <div
      className={className}
      style={{ height }}
      aria-hidden="true"
    >
      <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-line text-[0.6875rem] text-silver">
        No data yet
      </div>
    </div>
  );
}
