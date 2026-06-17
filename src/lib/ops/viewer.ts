/**
 * UniKart Ops — the authenticated operator ("viewer").
 *
 * Resolves the Better Auth session into an OpsViewer carrying the operator's
 * RBAC role. The role is read from the DATABASE (the session does not reliably
 * carry custom user columns — see getBillingInfo in auth-helpers), then the
 * ADMIN_EMAILS allowlist seeds the very first OWNER.
 *
 * Server-only (imports next/headers transitively via auth-helpers).
 */
import { getCurrentUser } from "../auth-helpers";
import { hasDatabase, prisma } from "../db";
import { isSeedAdmin } from "./env";
import { asRole, isOpsRole, type Role } from "./permissions";
import { recordAdminAudit } from "./audit";
import type { OpsViewer } from "./types";

/**
 * The current Ops operator, or null when there's no session, the account is
 * disabled, or (after allowlist seeding) the user has no Ops role.
 *
 * NOTE: returning a viewer does NOT mean they may enter Ops — a CUSTOMER role
 * still resolves to a viewer. Callers gate with `isOpsRole(viewer.role)` (the
 * console layout) or `can()` (actions). This lets the layout log an
 * authenticated-but-unauthorized attempt with the real identity.
 */
export async function getOpsViewer(): Promise<OpsViewer | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  let dbRole = "CUSTOMER";
  let status = "active";
  if (hasDatabase()) {
    try {
      const row = await prisma.user.findUnique({
        where: { id: user.id },
        select: { role: true, status: true },
      });
      dbRole = row?.role ?? "CUSTOMER";
      status = row?.status ?? "active";
    } catch (e) {
      console.error("[ops] getOpsViewer role lookup failed:", e);
    }
  }

  // A disabled operator account cannot use Ops.
  if (status === "disabled") return null;

  let role: Role = asRole(dbRole);
  let viaAllowlist = false;

  // Seed the first admin: an allowlisted email that hasn't been given a role yet
  // becomes OWNER. We do NOT override an explicitly-set role (so an OWNER can
  // later downgrade an allowlisted account).
  if (role === "CUSTOMER" && isSeedAdmin(user.email)) {
    role = "OWNER";
    viaAllowlist = true;
    await seedOwner(user.id, user.email);
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image ?? null,
    role,
    viaAllowlist,
  };
}

/** Persist the seeded OWNER role so the Users table + audit reflect reality. */
async function seedOwner(userId: string, email: string): Promise<void> {
  if (!hasDatabase()) return;
  try {
    await prisma.user.update({ where: { id: userId }, data: { role: "OWNER" } });
    await recordAdminAudit({
      actor: { id: userId, email, role: "OWNER" },
      action: "user.role.seed",
      targetType: "user",
      targetId: userId,
      targetUserId: userId,
      after: { role: "OWNER" },
      reason: "Seeded from ADMIN_EMAILS allowlist",
    });
  } catch (e) {
    console.error("[ops] seedOwner failed:", e);
  }
}

/** Convenience: a viewer that is actually allowed into Ops, else null. */
export async function getAuthorizedOpsViewer(): Promise<OpsViewer | null> {
  const viewer = await getOpsViewer();
  if (!viewer || !isOpsRole(viewer.role)) return null;
  return viewer;
}
