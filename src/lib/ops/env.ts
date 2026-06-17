/**
 * UniKart Ops — environment configuration.
 *
 * All Ops behaviour that depends on deployment (which host serves Ops, who the
 * seed admins are, timeouts, cost mode) is read here so there's a single,
 * documented surface. Secrets are NEVER read into the UI — only server code
 * touches these, and only non-secret values are ever surfaced to the client.
 *
 * Env vars (see .env.example + docs/OPS_DEPLOYMENT.md):
 *   OPS_HOST                  host that serves Ops in prod (default ops.uni-kart.com)
 *   ALLOW_OPS_ON_PUBLIC_HOST  "true" to allow /ops on the customer domain (default false)
 *   ENABLE_OPS_CONSOLE        "false" to hard-disable Ops everywhere (default true)
 *   ADMIN_EMAILS              comma-separated allowlist seeded as OWNER
 *   OPS_SESSION_TIMEOUT_MINUTES  idle timeout for Ops sessions (default 60)
 *   COST_ESTIMATE_MODE        "true" → cost figures are labelled estimates (default true)
 */

/** The customer-facing production host. Ops is 404 here in prod. */
export const PUBLIC_HOST = "uni-kart.com";

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

function int(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Host that should serve the Ops Console in production. */
export function opsHost(): string {
  return (process.env.OPS_HOST || "ops.uni-kart.com").trim().toLowerCase();
}

/** When true, /ops is reachable on the public host too (escape hatch / preview). */
export function allowOpsOnPublicHost(): boolean {
  return bool(process.env.ALLOW_OPS_ON_PUBLIC_HOST, false);
}

/** Master switch — when false, Ops returns 404 everywhere. */
export function opsConsoleEnabled(): boolean {
  return bool(process.env.ENABLE_OPS_CONSOLE, true);
}

/** Whether we're running outside production (localhost / dev / preview build). */
export function isDevLike(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Seed-admin allowlist (lowercased). These emails are treated as OWNER. */
export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS || "")
      .split(/[,\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** True when the given email is in the ADMIN_EMAILS allowlist. */
export function isSeedAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().has(email.trim().toLowerCase());
}

/** Idle timeout (minutes) for an Ops session. */
export function opsSessionTimeoutMinutes(): number {
  return int(process.env.OPS_SESSION_TIMEOUT_MINUTES, 60);
}

/** When true, all cost figures are clearly labelled as estimates. */
export function costEstimateMode(): boolean {
  return bool(process.env.COST_ESTIMATE_MODE, true);
}
