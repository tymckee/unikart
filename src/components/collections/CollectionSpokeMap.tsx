import Link from "next/link";
import {
  Briefcase,
  Clock,
  Cpu,
  Gift,
  House,
  Lamp,
  Plane,
  Shirt,
  type LucideIcon,
} from "lucide-react";
import { cn, svgRound } from "@/lib/utils";
import { WheelLogo } from "@/components/brand/WheelLogo";
import type { Collection } from "@/lib/types";

const ICONS: Record<string, LucideIcon> = {
  cpu: Cpu,
  home: House,
  lamp: Lamp,
  shirt: Shirt,
  gift: Gift,
  briefcase: Briefcase,
  plane: Plane,
  clock: Clock,
};

export function collectionIcon(key: string): LucideIcon {
  return ICONS[key] ?? Cpu;
}

interface SpokeCollection extends Collection {
  count: number;
}

/**
 * Radial "Spoke" map — each collection is a spoke around the hub.
 * A quiet expression of the wheel metaphor.
 */
export function CollectionSpokeMap({
  collections,
  total,
  className,
}: {
  collections: SpokeCollection[];
  total: number;
  className?: string;
}) {
  const n = collections.length;
  const spokeR = 33;
  const chipR = 43;

  return (
    <div className={cn("relative mx-auto aspect-square w-full max-w-md", className)}>
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full"
        fill="none"
      >
        <circle cx="50" cy="50" r="47" stroke="var(--color-line)" strokeWidth="0.6" />
        <circle cx="50" cy="50" r="40" stroke="var(--color-line)" strokeWidth="0.5" />
        {collections.map((_, i) => {
          const a = (i / n) * Math.PI * 2 - Math.PI / 2;
          return (
            <line
              key={i}
              x1={svgRound(50 + 11 * Math.cos(a))}
              y1={svgRound(50 + 11 * Math.sin(a))}
              x2={svgRound(50 + spokeR * Math.cos(a))}
              y2={svgRound(50 + spokeR * Math.sin(a))}
              stroke="var(--color-line)"
              strokeWidth="0.6"
            />
          );
        })}
      </svg>

      {/* Hub */}
      <div className="absolute left-1/2 top-1/2 flex h-[22%] w-[22%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-line bg-white shadow-soft">
        <WheelLogo size={22} className="text-ink" />
        <span className="mt-0.5 text-sm font-semibold tabular-nums text-ink">
          {total}
        </span>
        <span className="text-[0.5rem] uppercase tracking-wide text-silver">
          saved
        </span>
      </div>

      {/* Collection chips */}
      {collections.map((c, i) => {
        const a = (i / n) * Math.PI * 2 - Math.PI / 2;
        const left = svgRound(50 + chipR * Math.cos(a));
        const top = svgRound(50 + chipR * Math.sin(a));
        const Icon = collectionIcon(c.icon);
        return (
          <Link
            key={c.id}
            href={`/collections#${c.id}`}
            className="group absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white text-slate shadow-soft transition-all duration-200 group-hover:-translate-y-0.5 group-hover:text-ink group-hover:shadow-lift">
              <Icon size={18} strokeWidth={1.6} />
            </span>
            <span className="text-[0.625rem] font-medium text-slate group-hover:text-ink">
              {c.name}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
