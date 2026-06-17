/**
 * UniKart Ops — host gate.
 *
 * Single source of truth for "is the Ops Console allowed to be served for this
 * host?". Used by BOTH the edge proxy (proxy.ts) and the server-component
 * layout (src/app/ops/layout.tsx) so the rule is enforced twice (defence in
 * depth) and can never diverge.
 *
 * Pure function — no next/headers, no DB — so it's safe to import anywhere.
 */
import {
  allowOpsOnPublicHost,
  isDevLike,
  opsConsoleEnabled,
  opsHost,
} from "./env";

/** Strip the port and lowercase a Host / X-Forwarded-Host value. */
export function normalizeHost(host: string | null | undefined): string {
  if (!host) return "";
  // X-Forwarded-Host can be a comma-separated list; take the first.
  const first = host.split(",")[0].trim();
  return first.replace(/:\d+$/, "").toLowerCase();
}

export interface HostDecision {
  allowed: boolean;
  /** Why the decision was made — surfaced in logs / audit, never to customers. */
  reason:
    | "disabled"
    | "dev"
    | "ops-host"
    | "public-host-override"
    | "off-host";
  host: string;
}

/**
 * Decide whether Ops may be served for the given host.
 *
 *   - Ops disabled entirely → deny.
 *   - Non-production (localhost / dev / preview build) → allow (so /ops works
 *     at http://localhost:3000/ops).
 *   - host === OPS_HOST → allow.
 *   - ALLOW_OPS_ON_PUBLIC_HOST=true → allow anywhere (escape hatch).
 *   - otherwise (e.g. uni-kart.com) → deny → caller returns 404.
 */
export function decideOpsHost(rawHost: string | null | undefined): HostDecision {
  const host = normalizeHost(rawHost);

  if (!opsConsoleEnabled()) return { allowed: false, reason: "disabled", host };
  if (isDevLike()) return { allowed: true, reason: "dev", host };
  if (host && host === opsHost())
    return { allowed: true, reason: "ops-host", host };
  if (allowOpsOnPublicHost())
    return { allowed: true, reason: "public-host-override", host };

  return { allowed: false, reason: "off-host", host };
}

/** Convenience boolean form. */
export function isOpsHostAllowed(rawHost: string | null | undefined): boolean {
  return decideOpsHost(rawHost).allowed;
}
