/**
 * UniKart Ops — server-side guards for actions and API routes.
 *
 * Defence in depth: even though the console layout already gates by host +
 * role, EVERY server action and API route re-checks here (Next docs warn that
 * proxy/layout coverage can silently change; server functions must authorize
 * themselves). All guards funnel through `can()` — the single RBAC source.
 */
import { can, isOpsRole, type Permission } from "./permissions";
import { getOpsViewer } from "./viewer";
import { decideOpsHost } from "./host";
import { recordAccessDenied } from "./audit";
import { normalizeHost } from "./host";
import type { OpsActionFailure, OpsViewer } from "./types";

/**
 * Guard a server action by permission. Returns the viewer on success, or a typed
 * OpsActionResult error the action can return directly. Logs forbidden attempts.
 */
export async function requireOpsPermission(
  permission: Permission,
): Promise<{ ok: true; viewer: OpsViewer } | OpsActionFailure> {
  const viewer = await getOpsViewer();
  if (!viewer || !isOpsRole(viewer.role)) {
    return { ok: false, reason: "unauthorized", message: "Sign in to UniKart Ops." };
  }
  if (!can(viewer, permission)) {
    await recordAccessDenied(
      { id: viewer.id, email: viewer.email, role: viewer.role },
      permission,
      { kind: "action" },
    );
    return {
      ok: false,
      reason: "forbidden",
      message: `Your role (${viewer.role}) can't perform this action.`,
    };
  }
  return { ok: true, viewer };
}

/**
 * Guard an Ops API route (e.g. CSV export). Checks host + auth + permission and
 * returns either the viewer or a ready-to-return Response (404 off-host, 401
 * unauthenticated, 403 forbidden). Always adds noindex headers.
 */
export async function assertOpsApi(
  req: Request,
  permission: Permission,
): Promise<{ viewer: OpsViewer } | { response: Response }> {
  const noindex = { "X-Robots-Tag": "noindex, nofollow" };

  const host =
    req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  if (!decideOpsHost(host).allowed) {
    return { response: new Response("Not found", { status: 404, headers: noindex }) };
  }

  const viewer = await getOpsViewer();
  if (!viewer || !isOpsRole(viewer.role)) {
    return {
      response: new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...noindex, "content-type": "application/json" },
      }),
    };
  }
  if (!can(viewer, permission)) {
    await recordAccessDenied(
      { id: viewer.id, email: viewer.email, role: viewer.role },
      permission,
      { kind: "api", host: normalizeHost(host) },
    );
    return {
      response: new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...noindex, "content-type": "application/json" },
      }),
    };
  }
  return { viewer };
}
