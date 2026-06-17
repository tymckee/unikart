/**
 * UniKart Ops — Feature flags data access.
 *
 * Reads the FeatureFlag table for the /ops/feature-flags page. Each flag carries
 * a name, key, description, enabled state, rollout percent, and an allowlist /
 * denylist of emails (stored as JSON string columns). This module parses those
 * JSON columns into real arrays so the UI never has to.
 *
 * Every query guards `hasDatabase()` and is wrapped in try/catch, returning a
 * safe empty result on error — no fabricated flags. When there's no DB or no
 * rows, the page renders a calm "no flags" empty state (real data only).
 */
import { hasDatabase, prisma } from "@/lib/db";

/** The emergency kill switch — surfaced distinctly in the UI. */
export const MAINTENANCE_FLAG_KEY = "maintenance_mode";

/** One feature flag as the page renders it (JSON lists already parsed). */
export interface FeatureFlagView {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercent: number;
  allowlist: string[];
  denylist: string[];
  /** True for the emergency maintenance kill switch. */
  isMaintenance: boolean;
  updatedAt: string;
}

/**
 * Parse a JSON string column expected to hold an array of strings (emails / ids).
 * Tolerant: a malformed column degrades to an empty list rather than throwing.
 */
function parseStringList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  } catch {
    return [];
  }
}

function toView(r: {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercent: number;
  allowlistJson: string;
  denylistJson: string;
  updatedAt: Date;
}): FeatureFlagView {
  return {
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    enabled: r.enabled,
    rolloutPercent: r.rolloutPercent,
    allowlist: parseStringList(r.allowlistJson),
    denylist: parseStringList(r.denylistJson),
    isMaintenance: r.key === MAINTENANCE_FLAG_KEY,
    updatedAt: r.updatedAt.toISOString(),
  };
}

/**
 * All feature flags, sorted with the maintenance kill switch first, then enabled
 * flags, then alphabetically by name. Returns an empty array on no-DB / error.
 */
export async function getFlags(): Promise<FeatureFlagView[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await prisma.featureFlag.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        enabled: true,
        rolloutPercent: true,
        allowlistJson: true,
        denylistJson: true,
        updatedAt: true,
      },
    });

    const views = rows.map(toView);
    views.sort((a, b) => {
      // Emergency kill switch always first.
      if (a.isMaintenance !== b.isMaintenance) return a.isMaintenance ? -1 : 1;
      // Then enabled flags ahead of disabled ones.
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return views;
  } catch (e) {
    console.error("[ops] getFlags failed:", e);
    return [];
  }
}
