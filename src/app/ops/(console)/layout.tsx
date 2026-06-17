import { redirect } from "next/navigation";
import { getOpsViewer } from "@/lib/ops/viewer";
import { isOpsRole, can } from "@/lib/ops/permissions";
import { isDevLike } from "@/lib/ops/env";
import { recordAccessDenied } from "@/lib/ops/audit";
import { OPS_NAV, type OpsNavLink } from "@/lib/ops/nav";
import { OpsShell } from "@/components/ops/OpsShell";
import { OpsAccessDenied } from "@/components/ops/OpsAccessDenied";

/**
 * The authenticated Ops console gate. Runs on every /ops/* page (except
 * /ops/sign-in, which lives outside this route group):
 *
 *  1. No session → redirect to the Ops sign-in.
 *  2. Authenticated but not an Ops role (CUSTOMER) → log the attempt + show
 *     Access Denied (never a redirect loop, never a hint that data exists).
 *  3. Authorized → render the shell with a permission-filtered nav.
 *
 * This is the guaranteed RBAC enforcement; every action/route re-checks too.
 */
export const dynamic = "force-dynamic";

export default async function OpsConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await getOpsViewer();

  if (!viewer) {
    redirect("/ops/sign-in");
  }

  if (!isOpsRole(viewer.role)) {
    await recordAccessDenied(
      { id: viewer.id, email: viewer.email, role: viewer.role },
      "/ops",
      { kind: "console" },
    );
    return <OpsAccessDenied role={viewer.role} />;
  }

  // Permission-filtered navigation (FINANCE never sees Support, etc.).
  const navItems: OpsNavLink[] = OPS_NAV.filter((item) =>
    can(viewer, item.permission),
  ).map(({ href, label, iconKey, exact }) => ({ href, label, iconKey, exact }));

  const env = {
    label: isDevLike() ? "Local dev" : "Production",
    isProd: !isDevLike(),
  };

  return (
    <OpsShell
      viewer={{
        name: viewer.name,
        email: viewer.email,
        image: viewer.image,
        role: viewer.role,
        viaAllowlist: viewer.viaAllowlist,
      }}
      navItems={navItems}
      env={env}
    >
      {children}
    </OpsShell>
  );
}
