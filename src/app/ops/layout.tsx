import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { decideOpsHost } from "@/lib/ops/host";

/**
 * Outer Ops layout — the host + indexing boundary for EVERYTHING under /ops
 * (including the sign-in page, which must stay reachable unauthenticated).
 *
 *  - Host gate: in production, /ops on any host that isn't OPS_HOST returns 404
 *    (the customer domain never reveals that Ops exists). Dev / the
 *    ALLOW_OPS_ON_PUBLIC_HOST escape hatch allow it. This duplicates the proxy
 *    check on purpose — defence in depth, since proxy coverage can't be assumed
 *    on every deploy target (see STATUS.md note about Netlify + middleware).
 *  - noindex: `robots` metadata marks every Ops route noindex/nofollow, on top
 *    of the proxy's `X-Robots-Tag` header and robots.ts disallow.
 */
export const metadata: Metadata = {
  title: { default: "UniKart Ops", template: "%s · UniKart Ops" },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

// Host depends on the incoming request — never statically cache this subtree.
export const dynamic = "force-dynamic";

export default async function OpsRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host");
  if (!decideOpsHost(host).allowed) {
    // Off-host (or Ops disabled): behave as if these routes don't exist.
    notFound();
  }
  return <>{children}</>;
}
