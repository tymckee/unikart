/**
 * UniKart Ops — request context helpers (server-only).
 *
 * Pulls the caller's IP and user-agent from the incoming request headers for
 * audit logging, and provides a one-way IP hash for privacy-conscious analytics
 * (we store ipHash, never the raw IP, in AnalyticsEvent / APIUsageEvent).
 *
 * Imports next/headers — never import from a Client Component.
 */
import crypto from "node:crypto";
import { headers } from "next/headers";

export interface RequestContext {
  ipAddress: string | null;
  userAgent: string | null;
  host: string | null;
}

/** Best-effort client IP from the usual proxy headers (first hop). */
function ipFromHeaders(h: Headers): string | null {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || null;
  return h.get("x-real-ip") || h.get("x-nf-client-connection-ip") || null;
}

/** Audit-grade request context (raw IP kept — internal admin audit, not PII analytics). */
export async function getRequestContext(): Promise<RequestContext> {
  try {
    const h = await headers();
    return {
      ipAddress: ipFromHeaders(h),
      userAgent: h.get("user-agent"),
      host: h.get("x-forwarded-host") || h.get("host"),
    };
  } catch {
    return { ipAddress: null, userAgent: null, host: null };
  }
}

/**
 * One-way, salted hash of an IP for analytics. Salted with BETTER_AUTH_SECRET
 * (already a required, high-entropy server secret) so hashes are stable for
 * rate analysis but not reversible to an address. Returns null for no input.
 */
export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  const salt = process.env.BETTER_AUTH_SECRET || "unikart-ops";
  return crypto
    .createHash("sha256")
    .update(`${salt}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}

/** Convenience: hashed IP for the current request. */
export async function currentIpHash(): Promise<string | null> {
  const { ipAddress } = await getRequestContext();
  return hashIp(ipAddress);
}
