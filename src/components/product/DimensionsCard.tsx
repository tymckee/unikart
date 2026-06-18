import { Ruler } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { DimensionDiagram } from "@/components/product/DimensionDiagram";
import { formatMeasure, secondaryMeasure } from "@/lib/dimensions/units";
import type { DimensionModel, Measure } from "@/lib/dimensions/types";

/* ============================================================
   "Dimensions" — the visual sibling of "the gist". Renders the
   to-scale diagram plus a structured readout. Both read from the
   single parsed DimensionModel, so their numbers can never
   disagree (one source of truth). Renders nothing when there's no
   honest size to show — a blank beats a made-up box.
   ============================================================ */

const ORDER = ["width", "depth", "height", "diameter", "diagonal"] as const;
type AxisKey = (typeof ORDER)[number];

const AXIS_LABEL: Record<AxisKey, string> = {
  width: "Width",
  depth: "Depth",
  height: "Height",
  diameter: "Diameter",
  diagonal: "Diagonal",
};

export function DimensionsCard({ model }: { model: DimensionModel | null }) {
  if (!model) return null;

  const rows = ORDER.map((key) => [key, model[key]] as const).filter(
    ([, v]) => v != null,
  ) as [AxisKey, Measure][];

  if (rows.length === 0) return null;

  return (
    <GlassCard variant="solid" className="p-5">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate">
        <Ruler size={14} className="text-accent" /> Dimensions
      </div>

      <div className="rounded-xl bg-canvas/40 py-2">
        <DimensionDiagram model={model} />
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-x-4 gap-y-2.5 border-t border-line pt-4">
        {rows.map(([key, measure]) => (
          <div key={key} className="min-w-0">
            <dt className="text-[0.625rem] uppercase tracking-wide text-silver">
              {AXIS_LABEL[key]}
            </dt>
            <dd className="text-sm text-ink tabular-nums">
              {formatMeasure(measure)}{" "}
              <span className="text-silver">{secondaryMeasure(measure)}</span>
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 text-[0.625rem] text-silver">
        {model.diagonal && !model.width && !model.height
          ? "Screen diagonal from the listing, shown at 16:9"
          : model.toScale
            ? "Drawn to scale from the listing"
            : "Approximate outline — only the listed measurement is shown"}
      </p>
    </GlassCard>
  );
}
