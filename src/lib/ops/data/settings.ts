/**
 * UniKart Ops — Settings data access.
 *
 * Reads two real sources for the /ops/settings page:
 *   getSettings()  — the SystemSetting table (non-secret config), grouped by
 *                    category and with valueJson parsed into a real value.
 *   getAdminTeam() — every User carrying an Ops role (the admin team), so an
 *                    operator can see who has access at a glance.
 *
 * Secrets NEVER appear here: SystemSetting holds only non-secret configuration,
 * and the admin-team query selects no tokens, hashes, or card data. Every query
 * guards `hasDatabase()` and is wrapped in try/catch, returning a safe empty
 * result on error — no fabricated rows.
 */
import { hasDatabase, prisma } from "@/lib/db";
import { OPS_ROLES, type Role, asRole } from "@/lib/ops/permissions";

/** Categories a SystemSetting can belong to, in the order we render them. */
export const SETTING_CATEGORIES = [
  "general",
  "costs",
  "parser",
  "tracking",
  "notifications",
  "support",
  "retention",
] as const;

export type SettingCategory = (typeof SETTING_CATEGORIES)[number];

/** Human label + one-line description for each settings category. */
export const SETTING_CATEGORY_META: Record<
  SettingCategory,
  { label: string; description: string }
> = {
  general: {
    label: "General",
    description: "Baseline configuration that doesn't fit another group.",
  },
  costs: {
    label: "Costs",
    description: "Per-unit cost estimates. Edit these on the Costs page.",
  },
  parser: {
    label: "Parser",
    description: "Timeouts and watchlists for the URL parser.",
  },
  tracking: {
    label: "Tracking",
    description: "How often saved products are re-checked for price and stock.",
  },
  notifications: {
    label: "Notifications",
    description: "Soft limits on how many notifications a person receives.",
  },
  support: {
    label: "Support",
    description: "Defaults for the internal support console.",
  },
  retention: {
    label: "Retention",
    description: "How long event and audit rows are kept.",
  },
};

/** One SystemSetting row, with valueJson already parsed. */
export interface SettingView {
  id: string;
  key: string;
  category: SettingCategory;
  description: string;
  /** The parsed value (anything JSON can hold), or null on a malformed column. */
  value: unknown;
  /** The raw JSON string, kept so the editor can round-trip non-scalar values. */
  valueJson: string;
  /** True for scalar values (string / number / boolean) that SettingEditor can edit inline. */
  editable: boolean;
  updatedAt: string;
}

/** Settings grouped by category, in render order. Empty groups are dropped. */
export interface SettingGroup {
  category: SettingCategory;
  label: string;
  description: string;
  settings: SettingView[];
}

/** One admin-team member (an Ops-role user). No secrets selected. */
export interface AdminTeamMember {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  status: string;
  isInternal: boolean;
  lastActiveAt: string | null;
  createdAt: string;
}

/** Parse a valueJson column tolerantly: a malformed blob degrades to null. */
function parseValue(raw: string | null | undefined): unknown {
  if (raw == null || raw === "") return null;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** A value is inline-editable when it's a plain scalar (string/number/boolean). */
function isScalar(value: unknown): boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function asCategory(value: string): SettingCategory {
  return (SETTING_CATEGORIES as readonly string[]).includes(value)
    ? (value as SettingCategory)
    : "general";
}

/**
 * All SystemSettings, grouped by category in render order. Within a group,
 * settings are sorted by key. Returns an empty array on no-DB / error.
 */
export async function getSettings(): Promise<SettingGroup[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await prisma.systemSetting.findMany({
      orderBy: { key: "asc" },
      select: {
        id: true,
        key: true,
        category: true,
        description: true,
        valueJson: true,
        updatedAt: true,
      },
    });

    const views: SettingView[] = rows.map((r) => {
      const value = parseValue(r.valueJson);
      return {
        id: r.id,
        key: r.key,
        category: asCategory(r.category),
        description: r.description,
        value,
        valueJson: r.valueJson,
        editable: isScalar(value),
        updatedAt: r.updatedAt.toISOString(),
      };
    });

    // Bucket into the fixed category order, dropping empty groups.
    const groups: SettingGroup[] = [];
    for (const category of SETTING_CATEGORIES) {
      const settings = views.filter((v) => v.category === category);
      if (settings.length === 0) continue;
      const meta = SETTING_CATEGORY_META[category];
      groups.push({
        category,
        label: meta.label,
        description: meta.description,
        settings,
      });
    }
    return groups;
  } catch (e) {
    console.error("[ops] getSettings failed:", e);
    return [];
  }
}

/**
 * Every user with an Ops role (OWNER / ADMIN / SUPPORT / FINANCE / READONLY) —
 * the admin team. Ordered owners first, then by role, then most-recently-active.
 * No tokens, hashes, or card data are selected. Empty on no-DB / error.
 */
export async function getAdminTeam(): Promise<AdminTeamMember[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await prisma.user.findMany({
      where: { role: { in: OPS_ROLES } },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        status: true,
        isInternal: true,
        lastActiveAt: true,
        createdAt: true,
      },
    });

    const members: AdminTeamMember[] = rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: asRole(u.role),
      status: u.status,
      isInternal: u.isInternal,
      lastActiveAt: u.lastActiveAt ? u.lastActiveAt.toISOString() : null,
      createdAt: u.createdAt.toISOString(),
    }));

    const rank: Record<string, number> = {
      OWNER: 0,
      ADMIN: 1,
      SUPPORT: 2,
      FINANCE: 3,
      READONLY: 4,
    };
    members.sort((a, b) => {
      const byRole = (rank[a.role] ?? 9) - (rank[b.role] ?? 9);
      if (byRole !== 0) return byRole;
      const aT = a.lastActiveAt ? Date.parse(a.lastActiveAt) : 0;
      const bT = b.lastActiveAt ? Date.parse(b.lastActiveAt) : 0;
      return bT - aT;
    });
    return members;
  } catch (e) {
    console.error("[ops] getAdminTeam failed:", e);
    return [];
  }
}
