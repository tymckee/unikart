/**
 * UniKart Ops — navigation map.
 *
 * Each section declares the permission required to even see it. The console
 * layout filters this by `can(viewer, …)` and passes the allowed items (plain
 * serializable data) to the client sidebar, so the nav adapts to the operator's
 * role automatically — a FINANCE user never sees Support, etc.
 */
import type { Permission } from "./permissions";

export interface OpsNavItem {
  href: string;
  label: string;
  /** Maps to a lucide icon in OpsSidebar (kept as a string — RSC-serializable). */
  iconKey: string;
  permission: Permission;
  /** Marks the exact-match root (Overview) so it isn't "active" on every route. */
  exact?: boolean;
}

export const OPS_NAV: OpsNavItem[] = [
  { href: "/ops", label: "Overview", iconKey: "gauge", permission: "overview.read", exact: true },
  { href: "/ops/users", label: "Users", iconKey: "users", permission: "users.read" },
  { href: "/ops/products", label: "Products", iconKey: "package", permission: "products.read" },
  { href: "/ops/parser", label: "Parser", iconKey: "scan", permission: "parser.read" },
  { href: "/ops/jobs", label: "Jobs", iconKey: "listChecks", permission: "jobs.read" },
  { href: "/ops/api-usage", label: "API Usage", iconKey: "activity", permission: "apiUsage.read" },
  { href: "/ops/costs", label: "Costs", iconKey: "wallet", permission: "costs.read" },
  { href: "/ops/support", label: "Support", iconKey: "lifeBuoy", permission: "support.read" },
  { href: "/ops/notifications", label: "Notifications", iconKey: "bell", permission: "notifications.read" },
  { href: "/ops/billing", label: "Billing", iconKey: "creditCard", permission: "billing.read" },
  { href: "/ops/feature-flags", label: "Feature Flags", iconKey: "flag", permission: "featureFlags.read" },
  { href: "/ops/system", label: "System Health", iconKey: "server", permission: "system.read" },
  { href: "/ops/audit", label: "Audit Log", iconKey: "scroll", permission: "audit.read" },
  { href: "/ops/settings", label: "Settings", iconKey: "settings", permission: "settings.read" },
];

/** Serializable nav item handed to the client sidebar. */
export type OpsNavLink = Pick<OpsNavItem, "href" | "label" | "iconKey" | "exact">;
