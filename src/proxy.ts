/**
 * UniKart — Proxy (Next.js 16's renamed `middleware`). Node.js runtime.
 *
 * Sole responsibility: protect the Ops Console at the network boundary.
 *   1. Host gate — in production, /ops (and /api/ops) on any host that isn't
 *      OPS_HOST returns 404 (so the customer domain never reveals Ops exists).
 *      In dev / when ALLOW_OPS_ON_PUBLIC_HOST=true, it's allowed.
 *   2. noindex — every Ops response gets `X-Robots-Tag: noindex, nofollow`.
 *
 * This is the FAST, edge-level layer. It is intentionally cheap (host header +
 * env only — no DB, no session) so it works reliably on Netlify. Authentication
 * and RBAC are enforced again in the Ops layout and in every server
 * action/route (see src/lib/ops/guard.ts) — defence in depth, because proxy
 * coverage on some platforms can't be assumed.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decideOpsHost } from "@/lib/ops/host";

const NOINDEX = "noindex, nofollow";

export function proxy(request: NextRequest) {
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");

  const decision = decideOpsHost(host);

  if (!decision.allowed) {
    // Off-host (or disabled): behave as if the route doesn't exist.
    return new NextResponse("Not found", {
      status: 404,
      headers: { "X-Robots-Tag": NOINDEX, "content-type": "text/plain" },
    });
  }

  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", NOINDEX);
  return response;
}

export const config = {
  // Only run for Ops surfaces — never touches the customer app.
  matcher: ["/ops/:path*", "/api/ops/:path*"],
};
