/* eslint-disable @next/next/no-img-element -- Satori (next/og) renders raw <img>, not next/image */
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";
export const OG_ALT = "UniKart — a calm way to buy";

const INK = "#1d1d1f";
const SLATE = "#6e737c";
const SILVER = "#a1a7b0";
const PORCELAIN = "#fbfbfd";
const ACCENT = "#0071e3";
const DOWN = "#1fa971";
const DOWN_SOFT = "#e6f6ee";
const UP = "#e5484d";
const UP_SOFT = "#fceced";

interface Art {
  from: string;
  to: string;
  fg: string;
}

const CATEGORY_ART: Record<string, Art> = {
  Headphones: { from: "#EAF0FA", to: "#C9D8F0", fg: "#3E5C8A" },
  Home: { from: "#F3EEE7", to: "#E2D5C4", fg: "#8A6F4E" },
  Kitchen: { from: "#F6ECEA", to: "#ECCFC6", fg: "#A85C46" },
  Office: { from: "#ECF1EF", to: "#CFDED6", fg: "#4E7A66" },
  Gaming: { from: "#F0EAF7", to: "#D8C8EE", fg: "#6A4E9A" },
  Apparel: { from: "#F8ECF0", to: "#ECC9D6", fg: "#9A4E6E" },
  Toys: { from: "#FBF1E3", to: "#F2D9B0", fg: "#B07A2E" },
  "E-reader": { from: "#E8F2F1", to: "#C6E0DD", fg: "#3E7A74" },
  Travel: { from: "#E9F1FA", to: "#C8DEF2", fg: "#3E6E9A" },
  Footwear: { from: "#EEF2E9", to: "#D6E2C6", fg: "#5C7A3E" },
};
const DEFAULT_ART: Art = { from: "#F1F2F4", to: "#DDE0E6", fg: "#6E737C" };

function artFor(category?: string | null): Art {
  return (category && CATEGORY_ART[category]) || DEFAULT_ART;
}

function money(n: number | null | undefined, currency = "USD"): string {
  if (n == null) return "";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n);
  } catch {
    return `$${n}`;
  }
}

/**
 * Build a thin-lined wheel as an SVG data URI — the most reliable way to put
 * SVG through Satori (next/og's renderer).
 */
export function wheelDataUri(color: string, stroke = 3, spokes = 12): string {
  const c = 50;
  const inner = 13;
  const outer = 38.5;
  let lines = "";
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2 - Math.PI / 2;
    lines += `<line x1="${(c + inner * Math.cos(a)).toFixed(2)}" y1="${(c + inner * Math.sin(a)).toFixed(2)}" x2="${(c + outer * Math.cos(a)).toFixed(2)}" y2="${(c + outer * Math.sin(a)).toFixed(2)}" stroke="${color}" stroke-width="${(stroke * 0.5).toFixed(2)}" stroke-linecap="round"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="46" stroke="${color}" stroke-width="${stroke}"/><circle cx="50" cy="50" r="40" stroke="${color}" stroke-width="${(stroke * 0.5).toFixed(2)}" stroke-opacity="0.5"/>${lines}<circle cx="50" cy="50" r="10" stroke="${color}" stroke-width="${stroke}"/><circle cx="50" cy="50" r="3.4" fill="${color}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Wordmark "UniKart" (Uni ink + Kart slate). */
function Wordmark({ size = 34 }: { size?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.35 }}>
      <img width={size * 1.25} height={size * 1.25} alt="" src={wheelDataUri(INK, 4, 12)} />
      <div style={{ display: "flex", fontSize: size, fontWeight: 600, letterSpacing: -1, color: INK }}>
        <span>Uni</span>
        <span style={{ color: SLATE }}>Kart</span>
      </div>
    </div>
  );
}

/** A product "tile" — real image floating on a calm gradient, else a monogram. */
function Tile({
  width,
  height,
  radius,
  art,
  imageUrl,
  monogram,
  storeName,
  shadow,
}: {
  width: number;
  height: number;
  radius: number;
  art: Art;
  imageUrl?: string | null;
  monogram: string;
  storeName?: string;
  shadow?: boolean;
}) {
  const m = Math.min(width, height);
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        border: "1px solid rgba(17,19,23,0.06)",
        background: `radial-gradient(120% 120% at 30% 18%, ${art.from} 0%, ${art.to} 80%)`,
        boxShadow: shadow ? "0 30px 70px -28px rgba(17,19,23,0.30)" : "none",
      }}
    >
      {storeName ? (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            display: "flex",
            background: "rgba(255,255,255,0.78)",
            color: art.fg,
            fontSize: Math.max(13, m * 0.045),
            fontWeight: 600,
            padding: "5px 12px",
            borderRadius: 999,
          }}
        >
          {storeName}
        </div>
      ) : null}
      {imageUrl ? (
        <img
          width={Math.round(width * 0.78)}
          height={Math.round(height * 0.78)}
          alt=""
          src={imageUrl}
          style={{ objectFit: "contain" }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: m * 0.42,
            height: m * 0.42,
            borderRadius: m * 0.12,
            background: "rgba(255,255,255,0.72)",
            color: art.fg,
            fontSize: m * 0.22,
            fontWeight: 700,
          }}
        >
          {monogram}
        </div>
      )}
    </div>
  );
}

function Pill({
  children,
  bg,
  color,
  size = 16,
}: {
  children: React.ReactNode;
  bg: string;
  color: string;
  size?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: bg,
        color,
        fontSize: size,
        padding: "5px 12px",
        borderRadius: 999,
      }}
    >
      {children}
    </div>
  );
}

function shell(children: React.ReactNode) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        backgroundColor: PORCELAIN,
        backgroundImage: `radial-gradient(900px 520px at 50% -14%, rgba(0,113,227,0.12), rgba(251,251,253,0))`,
        fontFamily: "sans-serif",
        position: "relative",
      }}
    >
      {children}
      <div
        style={{
          position: "absolute",
          bottom: 46,
          left: 72,
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 24,
          color: SILVER,
        }}
      >
        <div style={{ width: 9, height: 9, borderRadius: 999, background: ACCENT, display: "flex" }} />
        uni-kart.com
      </div>
    </div>
  );
}

/** The default (home) card — brand statement + a sample product card. */
export function renderOgImage(): ImageResponse {
  const art = CATEGORY_ART.Headphones;
  return new ImageResponse(
    shell(
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 72px",
          gap: 56,
        }}
      >
        {/* Left — brand */}
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 600 }}>
          <Wordmark size={34} />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 30,
              fontSize: 62,
              fontWeight: 600,
              letterSpacing: -2,
              color: INK,
              lineHeight: 1.06,
            }}
          >
            <span>Save anything.</span>
            <span>Buy at the right moment.</span>
          </div>
          <div style={{ display: "flex", marginTop: 20, fontSize: 26, color: SLATE }}>
            Track price &amp; stock. Check out with less chaos.
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
            <Pill bg="#f0f1f4" color={SLATE} size={18}>Price tracking</Pill>
            <Pill bg="#f0f1f4" color={SLATE} size={18}>Stock alerts</Pill>
            <Pill bg="#f0f1f4" color={SLATE} size={18}>One cart</Pill>
          </div>
        </div>

        {/* Right — sample product card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 388,
            background: "#ffffff",
            borderRadius: 28,
            border: "1px solid rgba(17,19,23,0.06)",
            boxShadow: "0 34px 80px -30px rgba(17,19,23,0.32)",
            overflow: "hidden",
          }}
        >
          <Tile
            width={388}
            height={232}
            radius={0}
            art={art}
            monogram="S"
            storeName="Amazon"
          />
          <div style={{ display: "flex", flexDirection: "column", padding: "22px 24px" }}>
            <div style={{ display: "flex", fontSize: 23, fontWeight: 600, color: INK }}>
              Sony WH-1000XM5
            </div>
            <div style={{ display: "flex", marginTop: 6, fontSize: 17, color: SLATE }}>
              Amazon
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
              <span style={{ fontSize: 32, fontWeight: 600, color: INK }}>$328</span>
              <span style={{ fontSize: 18, color: SILVER, textDecoration: "line-through" }}>$399</span>
              <Pill bg={DOWN_SOFT} color={DOWN} size={16}>↓ 18%</Pill>
            </div>
            <div style={{ display: "flex", marginTop: 14 }}>
              <Pill bg={DOWN_SOFT} color={DOWN} size={15}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: DOWN, display: "flex" }} />
                In stock
              </Pill>
            </div>
          </div>
        </div>
      </div>,
    ),
    { ...OG_SIZE },
  );
}

export interface ProductCardData {
  title: string;
  storeName: string;
  storeDomain: string;
  brand?: string | null;
  category?: string | null;
  imageUrl?: string | null;
  currency: string;
  currentPrice: number | null;
  previousPrice?: number | null;
  availability: string;
}

const STOCK_LABEL: Record<string, { label: string; bg: string; fg: string }> = {
  in_stock: { label: "In stock", bg: DOWN_SOFT, fg: DOWN },
  low_stock: { label: "Low stock", bg: "#fbf0db", fg: "#c77a00" },
  out_of_stock: { label: "Out of stock", bg: UP_SOFT, fg: UP },
  preorder: { label: "Preorder", bg: "#eaf2fe", fg: "#0058b0" },
  unknown: { label: "Tracking", bg: "#f0f1f4", fg: SLATE },
};

/** Per-item share card for a specific saved product. */
export function renderProductOgImage(p: ProductCardData): ImageResponse {
  const art = artFor(p.category);
  const monogram = ((p.brand || p.title).trim()[0] || "U").toUpperCase();
  const drop =
    p.previousPrice != null && p.currentPrice != null && p.previousPrice > 0
      ? Math.round(((p.currentPrice - p.previousPrice) / p.previousPrice) * 100)
      : 0;
  const stock = STOCK_LABEL[p.availability] || STOCK_LABEL.unknown;

  return new ImageResponse(
    shell(
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          padding: "0 72px",
          gap: 60,
        }}
      >
        <Tile
          width={416}
          height={416}
          radius={36}
          art={art}
          imageUrl={p.imageUrl}
          monogram={monogram}
          storeName={p.storeName}
          shadow
        />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, maxWidth: 600 }}>
          <Wordmark size={26} />
          <div
            style={{
              display: "flex",
              marginTop: 20,
              fontSize: 48,
              fontWeight: 600,
              letterSpacing: -1,
              color: INK,
              lineHeight: 1.08,
            }}
          >
            {p.title.length > 64 ? p.title.slice(0, 63) + "…" : p.title}
          </div>
          <div style={{ display: "flex", marginTop: 14, fontSize: 24, color: SLATE }}>
            {p.storeName} · {p.storeDomain}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 24 }}>
            <span style={{ fontSize: 54, fontWeight: 600, color: INK }}>
              {money(p.currentPrice, p.currency)}
            </span>
            {drop < 0 && p.previousPrice != null ? (
              <>
                <span style={{ fontSize: 26, color: SILVER, textDecoration: "line-through" }}>
                  {money(p.previousPrice, p.currency)}
                </span>
                <Pill bg={DOWN_SOFT} color={DOWN} size={22}>↓ {Math.abs(drop)}%</Pill>
              </>
            ) : null}
          </div>
          <div style={{ display: "flex", marginTop: 18 }}>
            <Pill bg={stock.bg} color={stock.fg} size={20}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: stock.fg, display: "flex" }} />
              {stock.label}
            </Pill>
          </div>
        </div>
      </div>,
    ),
    { ...OG_SIZE },
  );
}

/**
 * Image used on a product's share card. Prefers a background-removed cutout
 * when available (see docs/future-integrations.md → AI product cutouts),
 * then the raw parsed image, else null (a branded gradient tile is drawn).
 */
export function cardImageUrl(p: {
  imageUrl?: string | null;
  cutoutUrl?: string | null;
}): string | null {
  return p.cutoutUrl ?? p.imageUrl ?? null;
}
