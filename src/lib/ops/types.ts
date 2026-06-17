/**
 * UniKart Ops — shared view types.
 *
 * These describe the shapes that flow from the Ops data layer (src/lib/ops/data)
 * into the Ops pages and reusable components. Enum-like fields mirror the
 * String columns in prisma/schema.prisma; the unions here are the UI's source
 * of truth.
 */
import type { Role } from "./permissions";

/** The authenticated Ops operator for the current request. */
export interface OpsViewer {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  /** True when the role came from the ADMIN_EMAILS env allowlist. */
  viaAllowlist: boolean;
}

/** The failure half of an Ops action result (also returned by guards). */
export interface OpsActionFailure {
  ok: false;
  reason: "unauthorized" | "forbidden" | "not-found" | "invalid" | "no-db" | "error";
  message?: string;
}

/** Result type for Ops server actions — mirrors the app's ActionResult shape. */
export type OpsActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | OpsActionFailure;

/* ---- Charting (dependency-free SVG charts) ---- */

export interface ChartPoint {
  /** Short axis label, e.g. "Jun 3" or "12:00". */
  label: string;
  value: number;
  /** Optional secondary value (e.g. failures vs successes). */
  value2?: number;
}

export interface NamedValue {
  name: string;
  value: number;
  /** Optional pre-formatted display string (e.g. "$12.40"). */
  display?: string;
}

/* ---- Metrics ---- */

export type MetricTone = "neutral" | "good" | "warn" | "bad" | "accent";

export interface MetricDelta {
  /** Signed percentage vs the comparison window. */
  pct: number;
  direction: "up" | "down" | "flat";
  /** When true, "up" is good (e.g. signups); when false, "up" is bad (e.g. failures). */
  upIsGood?: boolean;
}

export interface OpsMetric {
  label: string;
  value: string;
  hint?: string;
  tone?: MetricTone;
  delta?: MetricDelta | null;
  /** Marks a value as demo/mock fallback so the UI can label it honestly. */
  isDemo?: boolean;
}

/* ---- Status ---- */

export type SystemStatus = "operational" | "degraded" | "down" | "unknown" | "disabled";

export interface ServiceHealth {
  key: string;
  name: string;
  status: SystemStatus;
  detail?: string;
}

/* ---- Audit ---- */

export interface AuditLogView {
  id: string;
  adminUserId: string;
  adminEmail: string;
  role: string;
  action: string;
  targetType: string;
  targetId: string | null;
  targetUserId: string | null;
  reason: string | null;
  beforeJson: string | null;
  afterJson: string | null;
  metadataJson: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

/* ---- Paginated table results ---- */

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  /** True when the rows are demo/mock fallback. */
  isDemo?: boolean;
}
