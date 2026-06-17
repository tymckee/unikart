/**
 * UniKart Ops — roles & permissions (the single source of truth for RBAC).
 *
 * Every Ops page, server action, and API route authorizes through `can()` — no
 * scattered `if (role === "ADMIN")` checks. Permissions are `resource.action`
 * strings; roles map to a set of permissions (with `*` and `resource.*`
 * wildcards). This module is pure (no DB / no React) so it's testable and safe
 * to import from anywhere, including client components that only need to *hide*
 * UI (the server still re-checks).
 */

export const ROLES = [
  "OWNER",
  "ADMIN",
  "SUPPORT",
  "FINANCE",
  "READONLY",
  "CUSTOMER",
] as const;

export type Role = (typeof ROLES)[number];

/** Roles that may enter the Ops Console at all. CUSTOMER may not. */
export const OPS_ROLES: Role[] = ["OWNER", "ADMIN", "SUPPORT", "FINANCE", "READONLY"];

export function isRole(value: string | null | undefined): value is Role {
  return !!value && (ROLES as readonly string[]).includes(value);
}

export function asRole(value: string | null | undefined): Role {
  return isRole(value) ? value : "CUSTOMER";
}

/** True when the role is allowed to access Ops (any non-customer ops role). */
export function isOpsRole(value: string | null | undefined): boolean {
  return isRole(value) && OPS_ROLES.includes(value);
}

/**
 * The permission catalog. Format: `resource.action`. Keep names stable — they
 * appear in audit logs and tests.
 */
export type Permission =
  // Dashboards / analytics
  | "overview.read"
  | "analytics.read"
  // Users
  | "users.read"
  | "users.mutate"
  | "users.role"
  | "users.disable"
  | "users.export"
  | "users.note"
  | "users.impersonate" // reserved — read-only "support context view" only
  // Products
  | "products.read"
  | "products.mutate"
  | "products.reparse"
  | "products.export"
  // Parser
  | "parser.read"
  | "parser.retry"
  | "parser.mutate"
  | "parser.export"
  // Jobs
  | "jobs.read"
  | "jobs.mutate"
  // API usage
  | "apiUsage.read"
  | "apiUsage.export"
  // Costs
  | "costs.read"
  | "costs.mutate"
  | "costs.export"
  // Support
  | "support.read"
  | "support.write"
  // Notifications
  | "notifications.read"
  | "notifications.resend"
  | "notifications.mutate"
  // Billing
  | "billing.read"
  | "billing.refund"
  | "billing.export"
  // Feature flags
  | "featureFlags.read"
  | "featureFlags.mutate"
  // System health
  | "system.read"
  | "system.mutate"
  // Audit
  | "audit.read"
  | "audit.export"
  // Settings + admin team
  | "settings.read"
  | "settings.mutate"
  | "team.read"
  | "team.mutate"; // manage the admin team — OWNER only

export const ALL_PERMISSIONS: Permission[] = [
  "overview.read",
  "analytics.read",
  "users.read",
  "users.mutate",
  "users.role",
  "users.disable",
  "users.export",
  "users.note",
  "users.impersonate",
  "products.read",
  "products.mutate",
  "products.reparse",
  "products.export",
  "parser.read",
  "parser.retry",
  "parser.mutate",
  "parser.export",
  "jobs.read",
  "jobs.mutate",
  "apiUsage.read",
  "apiUsage.export",
  "costs.read",
  "costs.mutate",
  "costs.export",
  "support.read",
  "support.write",
  "notifications.read",
  "notifications.resend",
  "notifications.mutate",
  "billing.read",
  "billing.refund",
  "billing.export",
  "featureFlags.read",
  "featureFlags.mutate",
  "system.read",
  "system.mutate",
  "audit.read",
  "audit.export",
  "settings.read",
  "settings.mutate",
  "team.read",
  "team.mutate",
];

/** All read-only permissions — used to grant READONLY everything-but-mutations. */
const READ_PERMISSIONS = ALL_PERMISSIONS.filter((p) => p.endsWith(".read"));

/**
 * Role → permission grants. `*` matches everything; `resource.*` matches every
 * action on that resource. Resolved/expanded once in `permissionsFor()`.
 */
const ROLE_GRANTS: Record<Role, readonly (Permission | "*" | `${string}.*`)[]> = {
  // Everything, including admin-team management + owner transfer.
  OWNER: ["*"],

  // Most operations. NOT team.mutate (owner-only admin-team management); the
  // users.role action additionally refuses to grant/revoke OWNER unless the
  // actor is OWNER (enforced in the action, defence in depth).
  ADMIN: [
    "overview.read",
    "analytics.read",
    "users.read",
    "users.mutate",
    "users.role",
    "users.disable",
    "users.export",
    "users.note",
    "products.*",
    "parser.*",
    "jobs.*",
    "apiUsage.read",
    "apiUsage.export",
    "costs.read",
    "costs.mutate",
    "costs.export",
    "support.read",
    "support.write",
    "notifications.*",
    "billing.read",
    "billing.refund",
    "billing.export",
    "featureFlags.read",
    "featureFlags.mutate",
    "system.read",
    "system.mutate",
    "audit.read",
    "audit.export",
    "settings.read",
    "settings.mutate",
    "team.read",
  ],

  // Customer support: read users/products, write support, retry parses, resend
  // notifications. No billing mutation, no role changes, no feature flags.
  SUPPORT: [
    "overview.read",
    "users.read",
    "users.note",
    "products.read",
    "parser.read",
    "parser.retry",
    "jobs.read",
    "support.read",
    "support.write",
    "notifications.read",
    "notifications.resend",
    "audit.read",
  ],

  // Finance: billing + cost + usage reporting. No support/private notes, no
  // user mutations.
  FINANCE: [
    "overview.read",
    "analytics.read",
    "users.read",
    "apiUsage.read",
    "apiUsage.export",
    "costs.read",
    "costs.mutate",
    "costs.export",
    "billing.read",
    "billing.export",
    "system.read",
    "audit.read",
  ],

  // Read-only: dashboards everywhere, no mutations, no exports.
  READONLY: READ_PERMISSIONS,

  // No Ops access.
  CUSTOMER: [],
};

const permissionCache = new Map<Role, Set<Permission>>();

/** The fully-expanded permission set for a role (wildcards resolved). */
export function permissionsFor(role: Role): Set<Permission> {
  const cached = permissionCache.get(role);
  if (cached) return cached;

  const grants = ROLE_GRANTS[role] ?? [];
  const set = new Set<Permission>();
  for (const grant of grants) {
    if (grant === "*") {
      for (const p of ALL_PERMISSIONS) set.add(p);
    } else if (grant.endsWith(".*")) {
      const prefix = grant.slice(0, -1); // "products."
      for (const p of ALL_PERMISSIONS) if (p.startsWith(prefix)) set.add(p);
    } else {
      set.add(grant as Permission);
    }
  }
  permissionCache.set(role, set);
  return set;
}

/** Minimal shape `can()` needs — anything carrying a role. */
export interface RoleBearer {
  role: Role | string | null | undefined;
}

/** The core authorization check. Centralize ALL access decisions here. */
export function can(
  user: RoleBearer | null | undefined,
  permission: Permission,
): boolean {
  if (!user) return false;
  const role = asRole(user.role);
  return permissionsFor(role).has(permission);
}

/** True if the user has every one of the given permissions. */
export function canAll(
  user: RoleBearer | null | undefined,
  permissions: Permission[],
): boolean {
  return permissions.every((p) => can(user, p));
}

/** True if the user has any of the given permissions. */
export function canAny(
  user: RoleBearer | null | undefined,
  permissions: Permission[],
): boolean {
  return permissions.some((p) => can(user, p));
}

/** Human label + one-line description for a role (used in the UI). */
export const ROLE_META: Record<Role, { label: string; description: string }> = {
  OWNER: { label: "Owner", description: "Full access, including the admin team and owner transfer." },
  ADMIN: { label: "Admin", description: "Most operations. No admin-team management or owner transfer." },
  SUPPORT: { label: "Support", description: "Help customers: read users/products, notes, parse retries, resends." },
  FINANCE: { label: "Finance", description: "Billing, costs, and usage reporting. No customer data mutations." },
  READONLY: { label: "Read-only", description: "View every dashboard. Cannot change anything." },
  CUSTOMER: { label: "Customer", description: "No Ops access." },
};
