/**
 * UniKart Ops — display formatting (client-safe, no server imports).
 * Calm, tabular-friendly, honest ("—" for unknown, never a fabricated value).
 */

const nf = new Intl.NumberFormat("en-US");

/** Plain integer with thousands separators. "—" for null/NaN. */
export function num(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return nf.format(Math.round(n));
}

/** Compact number: 1234 → "1.2k", 2_500_000 → "2.5M". */
export function compact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

/** Percentage from a 0–100 value. `pct(94.23)` → "94.2%". */
export function pct(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

/** Ratio (0–1) → percentage. `ratioPct(0.94)` → "94%". */
export function ratioPct(n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

/** USD with adaptive precision. Small amounts keep cents; large go compact. */
export function usd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 100000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  const digits = Math.abs(n) < 1 && n !== 0 ? 4 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: 2,
  }).format(n);
}

/** Bytes → "1.4 GB". */
export function bytes(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/** Milliseconds → "340ms" / "1.2s" / "3m 04s". */
export function duration(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${String(rem).padStart(2, "0")}s`;
}

/** Short date "Jun 17". */
export function shortDate(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Date + time "Jun 17, 14:32". */
export function dateTime(iso: string | Date | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Truncate a string with an ellipsis. */
export function truncate(s: string | null | undefined, max = 48): string {
  if (!s) return "—";
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Shorten an id for display: "clz9x…a8f2". */
export function shortId(id: string | null | undefined): string {
  if (!id) return "—";
  return id.length <= 12 ? id : `${id.slice(0, 5)}…${id.slice(-4)}`;
}
