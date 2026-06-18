import { svgRound } from "@/lib/utils";
import {
  CANVAS,
  DEFAULT_AR,
  fitDefaultFace,
  fitFace,
  heightDim,
  widthDim,
  type DimLine,
  type Face,
} from "@/lib/dimensions/geometry";
import { formatMeasure, toMm } from "@/lib/dimensions/units";
import type { DimensionModel, Measure, Unit } from "@/lib/dimensions/types";

/* ============================================================
   The dimension diagram — a calm, to-scale front-elevation (or
   top-down footprint) silhouette with architect-style dimension
   lines. Pure & server-renderable; every coordinate is svgRound'd.
   Honesty rules: ONE uniform scale on both plane axes (never
   stretched), only known axes are labelled, and a single-axis
   item is drawn with a dashed "illustrative" outline so its
   proportion never reads as measured.
   ============================================================ */

const r = svgRound;

type Mode = "plane" | "round" | "diagonal";

const UNIT_WORD: Record<Unit, string> = {
  in: "inches",
  cm: "centimeters",
  mm: "millimeters",
  ft: "feet",
  m: "meters",
};

const SHAPE_WORD: Record<DimensionModel["shape"], string> = {
  chair: "Chair",
  sofa: "Sofa",
  table: "Table",
  desk: "Desk",
  bed: "Bed",
  shelf: "Shelf",
  dresser: "Dresser",
  nightstand: "Nightstand",
  rug: "Rug",
  lamp: "Lamp",
  tv: "Television",
  box: "Item",
};

const AXIS_WORD = {
  width: "wide",
  depth: "deep",
  height: "tall",
  diameter: "across",
  diagonal: "diagonal",
} as const;

function planeBKey(m: DimensionModel): "depth" | "height" {
  return m.plane === "footprint" ? "depth" : "height";
}

function modeFor(m: DimensionModel): Mode {
  const bKey = planeBKey(m);
  if (m.diagonal && m.shape === "tv" && !(m.width && m.height)) return "diagonal";
  if (
    m.diameter &&
    (m.shape === "rug" || m.shape === "table") &&
    !(m.width && m[bKey])
  ) {
    return "round";
  }
  return "plane";
}

/** Build the descriptive aria sentence — every datum lives here so a screen
 *  reader never hears a number twice from the (aria-hidden) geometry. */
function ariaFor(m: DimensionModel, mode: Mode): string {
  const lead = m.toScale ? "drawn to scale" : "approximate outline";
  // Describe only the axes the diagram actually draws, so the spoken label can
  // never contradict the image. Off-plane axes (e.g. depth on an elevation) are
  // conveyed by the readout list below the SVG, not the picture's label.
  const order: readonly (keyof typeof AXIS_WORD)[] =
    mode === "diagonal"
      ? ["diagonal"]
      : mode === "round"
        ? ["diameter"]
        : m.plane === "footprint"
          ? ["width", "depth"]
          : ["width", "height"];
  const present = order
    .map((k) => [k, m[k]] as const)
    .filter(([, v]) => v != null) as [keyof typeof AXIS_WORD, Measure][];

  if (present.length === 0) return `${SHAPE_WORD[m.shape]}.`;
  const allSameUnit = present.every(([, v]) => v.unit === present[0][1].unit);
  const clauses = present.map(([k, v], i) => {
    const unit = !allSameUnit || i === 0 ? ` ${UNIT_WORD[v.unit]}` : "";
    return `${v.value}${unit} ${AXIS_WORD[k]}`;
  });

  // A missing standard plane axis is named, mirroring the dashed outline.
  let missing = "";
  if (!m.toScale && mode === "plane") {
    const bKey = planeBKey(m);
    if (!m.width) missing = "; width not listed";
    else if (!m[bKey]) missing = `; ${bKey} not listed`;
  }

  return `${SHAPE_WORD[m.shape]}, ${lead}: ${clauses.join(", ")}${missing}.`;
}

/* ---- Silhouettes (drawn within the face box) ---- */

interface OutlineStyle {
  fill: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
}

function rectEl(x: number, y: number, w: number, h: number, s: OutlineStyle, rx = 0) {
  return (
    <rect
      x={r(x)}
      y={r(y)}
      width={r(w)}
      height={r(h)}
      rx={rx || undefined}
      fill={s.fill}
      stroke={s.stroke}
      strokeWidth={s.strokeWidth}
      strokeDasharray={s.strokeDasharray}
      strokeLinejoin="round"
    />
  );
}

function hairline(x1: number, y1: number, x2: number, y2: number) {
  return (
    <line
      x1={r(x1)}
      y1={r(y1)}
      x2={r(x2)}
      y2={r(y2)}
      stroke="var(--color-line-strong)"
      strokeWidth={1}
    />
  );
}

function poly(points: number[][], s: OutlineStyle) {
  return (
    <polygon
      points={points.map(([px, py]) => `${r(px)},${r(py)}`).join(" ")}
      fill={s.fill}
      stroke={s.stroke}
      strokeWidth={s.strokeWidth}
      strokeDasharray={s.strokeDasharray}
      strokeLinejoin="round"
    />
  );
}

function path(d: string, s: OutlineStyle) {
  return (
    <path
      d={d}
      fill={s.fill}
      stroke={s.stroke}
      strokeWidth={s.strokeWidth}
      strokeDasharray={s.strokeDasharray}
      strokeLinejoin="round"
    />
  );
}

function silhouette(
  shape: DimensionModel["shape"],
  mode: Mode,
  f: Face,
  s: OutlineStyle,
  showDetail: boolean,
): React.ReactNode {
  const { x, y, w, h } = f;
  const cx = x + w / 2;

  if (mode === "round") {
    return (
      <ellipse
        cx={r(cx)}
        cy={r(y + h / 2)}
        rx={r(w / 2)}
        ry={r(h / 2)}
        fill={s.fill}
        stroke={s.stroke}
        strokeWidth={s.strokeWidth}
        strokeDasharray={s.strokeDasharray}
      />
    );
  }

  switch (shape) {
    case "table":
    case "desk": {
      const slab = h * 0.13;
      const legW = w * 0.05;
      const inset = w * 0.08;
      return (
        <>
          {rectEl(x, y, w, slab, s)}
          {rectEl(x + inset, y + slab, legW, h - slab, s)}
          {rectEl(x + w - inset - legW, y + slab, legW, h - slab, s)}
        </>
      );
    }
    case "chair": {
      const seatTop = y + h * 0.5;
      const seatBot = seatTop + h * 0.12;
      const legInset = w * 0.14;
      const d =
        `M ${r(x)} ${r(y)} L ${r(x + w)} ${r(y)} L ${r(x + w)} ${r(y + h)} ` +
        `L ${r(x + w - legInset)} ${r(y + h)} L ${r(x + w - legInset)} ${r(seatBot)} ` +
        `L ${r(x + legInset)} ${r(seatBot)} L ${r(x + legInset)} ${r(y + h)} ` +
        `L ${r(x)} ${r(y + h)} Z`;
      return (
        <>
          {path(d, s)}
          {showDetail && hairline(x, seatTop, x + w, seatTop)}
        </>
      );
    }
    case "sofa": {
      const armW = w * 0.14;
      const seatY = y + h * 0.42;
      const d =
        `M ${r(x)} ${r(y + h)} L ${r(x)} ${r(y)} L ${r(x + w)} ${r(y)} ` +
        `L ${r(x + w)} ${r(y + h)} L ${r(x + w - armW)} ${r(y + h)} ` +
        `L ${r(x + w - armW)} ${r(seatY)} L ${r(x + armW)} ${r(seatY)} ` +
        `L ${r(x + armW)} ${r(y + h)} Z`;
      return (
        <>
          {path(d, s)}
          {showDetail && hairline(x + armW, seatY, x + w - armW, seatY)}
        </>
      );
    }
    case "shelf":
    case "dresser":
    case "nightstand": {
      const rows = shape === "nightstand" ? 2 : 4;
      const lines = [];
      for (let i = 1; i < rows; i++) {
        const ly = y + (h * i) / rows;
        if (showDetail)
          lines.push(<g key={i}>{hairline(x, ly, x + w, ly)}</g>);
      }
      return (
        <>
          {rectEl(x, y, w, h, s)}
          {lines}
        </>
      );
    }
    case "bed": {
      const rx = Math.min(w, h) * 0.06;
      return (
        <>
          {rectEl(x, y, w, h, s, rx)}
          {showDetail && hairline(x + w * 0.06, y + h * 0.22, x + w - w * 0.06, y + h * 0.22)}
        </>
      );
    }
    case "rug": {
      return (
        <>
          {rectEl(x, y, w, h, s)}
          {showDetail &&
            rectEl(x + w * 0.06, y + h * 0.06, w * 0.88, h * 0.88, {
              ...s,
              fill: "none",
              stroke: "var(--color-line-strong)",
              strokeWidth: 1,
              strokeDasharray: undefined,
            })}
        </>
      );
    }
    case "lamp": {
      const shadeBot = y + h * 0.24;
      return (
        <>
          {poly(
            [
              [cx - w * 0.25, y],
              [cx + w * 0.25, y],
              [cx + w * 0.4, shadeBot],
              [cx - w * 0.4, shadeBot],
            ],
            s,
          )}
          {rectEl(cx - 1, shadeBot, 2, y + h - shadeBot - h * 0.02, s)}
          <ellipse
            cx={r(cx)}
            cy={r(y + h - h * 0.02)}
            rx={r(w * 0.4)}
            ry={r(h * 0.02 + 1.5)}
            fill={s.fill}
            stroke={s.stroke}
            strokeWidth={s.strokeWidth}
            strokeDasharray={s.strokeDasharray}
          />
        </>
      );
    }
    case "tv": {
      const bezelH = h * 0.82;
      return (
        <>
          {rectEl(x, y, w, bezelH, s, 2)}
          {rectEl(cx - 2, y + bezelH, 4, h * 0.1, s)}
          {rectEl(cx - w * 0.18, y + h * 0.94, w * 0.36, h * 0.05, s, 1)}
          {mode === "diagonal" && (
            <line
              x1={r(x + w * 0.08)}
              y1={r(y + bezelH * 0.9)}
              x2={r(x + w * 0.92)}
              y2={r(y + bezelH * 0.1)}
              stroke="var(--color-line-strong)"
              strokeWidth={1}
            />
          )}
        </>
      );
    }
    case "box":
    default:
      return rectEl(x, y, w, h, s);
  }
}

/* ---- Dimension line + label primitives ---- */

function DimLineEls({ d }: { d: DimLine }) {
  return (
    <g>
      {d.witness.map(([x1, y1, x2, y2], i) => (
        <line key={`w${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-line)" strokeWidth={1} />
      ))}
      <line x1={d.line[0]} y1={d.line[1]} x2={d.line[2]} y2={d.line[3]} stroke="var(--color-silver)" strokeWidth={1} />
      {d.ticks.map(([x1, y1, x2, y2], i) => (
        <line key={`t${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-slate)" strokeWidth={1} />
      ))}
    </g>
  );
}

function Label({
  cx,
  cy,
  text,
  accent,
  rotate,
}: {
  cx: number;
  cy: number;
  text: string;
  accent: boolean;
  rotate?: boolean;
}) {
  const halfW = Math.max(17, text.length * 3.4);
  const inner = (
    <>
      <rect x={r(cx - halfW)} y={r(cy - 8)} width={r(halfW * 2)} height={16} rx={4} fill="var(--color-white)" />
      <text
        x={r(cx)}
        y={r(cy + 4)}
        textAnchor="middle"
        fontSize={12}
        fontWeight={500}
        fill="var(--color-ink)"
        style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.01em" }}
      >
        {text}
      </text>
      {accent && (
        <line
          x1={r(cx - halfW + 3)}
          y1={r(cy + 8)}
          x2={r(cx + halfW - 3)}
          y2={r(cy + 8)}
          stroke="var(--color-accent)"
          strokeWidth={1}
        />
      )}
    </>
  );
  return rotate ? <g transform={`rotate(-90 ${r(cx)} ${r(cy)})`}>{inner}</g> : inner;
}

/* ---- Component ---- */

export function DimensionDiagram({ model }: { model: DimensionModel }) {
  const mode = modeFor(model);
  const bKey = planeBKey(model);
  const bothPlane = Boolean(model.width && model[bKey]);

  let face: Face;
  if (mode === "diagonal") face = fitDefaultFace(16 / 9, 0.92);
  else if (mode === "round") face = fitDefaultFace(1, 0.92);
  else if (bothPlane) face = fitFace(toMm(model.width!) / toMm(model[bKey]!));
  else face = fitDefaultFace(DEFAULT_AR[model.shape]);

  const dashed = mode === "plane" && !bothPlane; // single-axis → illustrative
  const outline: OutlineStyle = dashed
    ? { fill: "none", stroke: "var(--color-line)", strokeWidth: 1, strokeDasharray: "3 3" }
    : { fill: "var(--color-canvas)", stroke: "var(--color-graphite)", strokeWidth: 1.25 };

  // Which dimension lines to draw + labels.
  const lines: React.ReactNode[] = [];
  if (mode === "plane") {
    if (model.width) {
      const wd = widthDim(face);
      lines.push(
        <g key="w">
          <DimLineEls d={wd} />
          <Label cx={wd.label.x} cy={wd.label.y} text={formatMeasure(model.width)} accent={model.headline === "width"} />
        </g>,
      );
    }
    const bMeasure = model[bKey];
    if (bMeasure) {
      const hd = heightDim(face);
      lines.push(
        <g key="b">
          <DimLineEls d={hd} />
          <Label cx={hd.label.x} cy={hd.label.y} text={formatMeasure(bMeasure)} accent={model.headline === bKey} rotate />
        </g>,
      );
    }
  } else if (mode === "round" && model.diameter) {
    const cy = face.y + face.h / 2;
    const wd: DimLine = {
      witness: [],
      line: [face.x, cy, face.x + face.w, cy],
      ticks: [
        [r(face.x - 3), r(cy + 3), r(face.x + 3), r(cy - 3)],
        [r(face.x + face.w - 3), r(cy + 3), r(face.x + face.w + 3), r(cy - 3)],
      ],
      label: { x: face.x + face.w / 2, y: r(face.y + face.h + 16) },
    };
    lines.push(
      <g key="dia">
        <line x1={r(face.x)} y1={r(cy)} x2={r(face.x + face.w)} y2={r(cy)} stroke="var(--color-silver)" strokeWidth={1} />
        {wd.ticks.map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-slate)" strokeWidth={1} />
        ))}
        <Label cx={wd.label.x} cy={wd.label.y} text={`Ø ${formatMeasure(model.diameter)}`} accent />
      </g>,
    );
  } else if (mode === "diagonal" && model.diagonal) {
    lines.push(
      <g key="diag">
        <Label
          cx={face.x + face.w / 2}
          cy={r(face.y + face.h + 16)}
          text={`${formatMeasure(model.diagonal)} diagonal`}
          accent
        />
      </g>,
    );
  }

  return (
    <svg
      viewBox={`0 0 ${CANVAS.w} ${CANVAS.h}`}
      width="100%"
      className="animate-fade"
      role="img"
      aria-label={ariaFor(model, mode)}
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <title>{ariaFor(model, mode)}</title>
      <g aria-hidden="true">
        {silhouette(model.shape, mode, face, outline, !dashed)}
        {lines}
      </g>
    </svg>
  );
}
