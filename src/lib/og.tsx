/* eslint-disable @next/next/no-img-element -- Satori (next/og) renders raw <img>, not next/image */
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";
export const OG_ALT = "UniKart — a calm way to buy";

/**
 * Build a thin-lined wheel as an SVG data URI. Rendering the wheel as an
 * <img> (rather than inline SVG) is the most reliable path through Satori,
 * the engine behind next/og.
 */
export function wheelDataUri(color: string, stroke = 3, spokes = 12): string {
  const c = 50;
  const inner = 13;
  const outer = 38.5;
  let lines = "";
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2 - Math.PI / 2;
    const x1 = (c + inner * Math.cos(a)).toFixed(2);
    const y1 = (c + inner * Math.sin(a)).toFixed(2);
    const x2 = (c + outer * Math.cos(a)).toFixed(2);
    const y2 = (c + outer * Math.sin(a)).toFixed(2);
    lines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${(
      stroke * 0.5
    ).toFixed(2)}" stroke-linecap="round"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
    <circle cx="50" cy="50" r="46" stroke="${color}" stroke-width="${stroke}"/>
    <circle cx="50" cy="50" r="40" stroke="${color}" stroke-width="${(stroke * 0.5).toFixed(2)}" stroke-opacity="0.5"/>
    ${lines}
    <circle cx="50" cy="50" r="10" stroke="${color}" stroke-width="${stroke}"/>
    <circle cx="50" cy="50" r="3.4" fill="${color}"/>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** The shared social preview image (Open Graph + Twitter). */
export function renderOgImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fbfbfd",
          backgroundImage:
            "radial-gradient(900px 520px at 50% -12%, rgba(0,113,227,0.12), rgba(251,251,253,0))",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Quiet wheel watermark */}
        <img
          width={680}
          height={680}
          alt=""
          src={wheelDataUri("#1d1d1f", 2.5, 16)}
          style={{ position: "absolute", right: -150, bottom: -190, opacity: 0.05 }}
        />

        {/* Mark */}
        <img width={128} height={128} alt="" src={wheelDataUri("#1d1d1f", 4, 12)} />

        {/* Wordmark */}
        <div
          style={{
            display: "flex",
            marginTop: 34,
            fontSize: 108,
            fontWeight: 600,
            letterSpacing: -4,
            color: "#1d1d1f",
          }}
        >
          <span>Uni</span>
          <span style={{ color: "#6e737c" }}>Kart</span>
        </div>

        {/* Tagline */}
        <div style={{ display: "flex", marginTop: 14, fontSize: 40, color: "#6e737c" }}>
          Save anything. Buy at the right moment.
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: 46,
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 26,
            color: "#a1a7b0",
          }}
        >
          <div
            style={{
              width: 9,
              height: 9,
              borderRadius: 9999,
              backgroundColor: "#0071e3",
              display: "flex",
            }}
          />
          <span>uni-kart.com · a calm buying operating system</span>
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
