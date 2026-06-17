import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names and resolve Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as currency. Falls back gracefully for unknown codes. */
export function formatPrice(
  amount: number | null | undefined,
  currency = "USD",
  opts: { compact?: boolean } = {},
): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
      notation: opts.compact ? "compact" : "standard",
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

/** Percentage change between two prices, signed. */
export function priceDelta(
  current: number | null | undefined,
  previous: number | null | undefined,
): { abs: number; pct: number; direction: "down" | "up" | "flat" } | null {
  if (current == null || previous == null || previous === 0) return null;
  const abs = current - previous;
  const pct = (abs / previous) * 100;
  const direction = abs < -0.001 ? "down" : abs > 0.001 ? "up" : "flat";
  return { abs, pct, direction };
}

/** Human relative time, e.g. "2h ago", "3d ago". */
export function timeAgo(date: Date | string | number, now = Date.now()): string {
  const t = new Date(date).getTime();
  const diff = Math.max(0, now - t);
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.round(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(d / 365)}y ago`;
}

/** Pull a clean display domain from a URL or domain string. */
export function prettyDomain(input: string): string {
  try {
    const url = input.includes("://") ? input : `https://${input}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return input.replace(/^www\./, "");
  }
}

/** Title-case-ish store name from a domain, e.g. "store.apple.com" → "Apple". */
export function storeNameFromDomain(domain: string): string {
  const host = prettyDomain(domain);
  const parts = host.split(".");
  const core = parts.length > 2 ? parts[parts.length - 2] : parts[0];
  return core.charAt(0).toUpperCase() + core.slice(1);
}

/** Deterministic 0–1 hash from a string (for stable mock visuals). */
export function hashUnit(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/** Clamp helper. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Round to 3 decimals for SVG coordinates. Math.sin/cos can differ between
 * Node (SSR) and the browser at ~1e-15, which causes React hydration
 * mismatches; rounding makes server and client output identical.
 */
export function svgRound(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Basic URL validity check for the paste bar. */
export function looksLikeUrl(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i.test(v);
}
