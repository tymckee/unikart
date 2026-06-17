import { svgRound } from "@/lib/utils";
import { OpsStatusPill } from "./OpsStatusPill";
import type { ServiceHealth, SystemStatus } from "@/lib/ops/types";

const STATUS_COLOR: Record<SystemStatus, string> = {
  operational: "var(--color-down)",
  degraded: "var(--color-warn)",
  down: "var(--color-up)",
  disabled: "var(--color-titanium)",
  unknown: "var(--color-silver)",
};

const ORDER: Record<SystemStatus, number> = {
  down: 0,
  degraded: 1,
  unknown: 2,
  disabled: 3,
  operational: 4,
};

/**
 * System health as the UniKart wheel: each service is a spoke, coloured by
 * status; the hub reflects the worst current state. Subtle, geometric — the
 * brand motif used "lightly", never a literal bicycle.
 */
export function OpsWheelHealth({ services }: { services: ServiceHealth[] }) {
  const worst = services.reduce<SystemStatus>((acc, s) => {
    return ORDER[s.status] < ORDER[acc] ? s.status : acc;
  }, "operational");
  const hubColor = STATUS_COLOR[worst];
  const n = Math.max(services.length, 1);
  const c = 80;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
      <svg width={160} height={160} viewBox="0 0 160 160" role="img" aria-label="System health wheel">
        {/* Rim — double hairline */}
        <circle cx={c} cy={c} r="70" fill="none" stroke="var(--color-line-strong)" strokeWidth="2" />
        <circle cx={c} cy={c} r="61" fill="none" stroke="var(--color-line)" strokeWidth="1" />
        {/* Spokes — one per service */}
        {services.map((s, i) => {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          const inner = 22;
          const outer = 60;
          return (
            <g key={s.key}>
              <line
                x1={svgRound(c + inner * Math.cos(a))}
                y1={svgRound(c + inner * Math.sin(a))}
                x2={svgRound(c + outer * Math.cos(a))}
                y2={svgRound(c + outer * Math.sin(a))}
                stroke={STATUS_COLOR[s.status]}
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.9"
              />
              <circle
                cx={svgRound(c + outer * Math.cos(a))}
                cy={svgRound(c + outer * Math.sin(a))}
                r="3"
                fill={STATUS_COLOR[s.status]}
              />
            </g>
          );
        })}
        {/* Hub */}
        <circle cx={c} cy={c} r="18" fill="none" stroke={hubColor} strokeWidth="2.5" />
        <circle cx={c} cy={c} r="6" fill={hubColor} />
      </svg>

      <ul className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {services.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3 rounded-lg px-1 py-1">
            <div className="min-w-0">
              <p className="truncate text-sm text-ink">{s.name}</p>
              {s.detail && <p className="truncate text-xs text-silver">{s.detail}</p>}
            </div>
            <OpsStatusPill status={s.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
