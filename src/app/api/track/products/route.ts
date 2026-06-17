import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { hasDatabase, prisma } from "@/lib/db";

const MAX_PRODUCTS = 40;

function authorized(header: string | null, secret: string): boolean {
  const provided = (header ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  // Length check avoids timingSafeEqual throwing; the constant-time compare
  // then prevents a byte-by-byte timing oracle on the secret.
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const dynamic = "force-dynamic";

/**
 * Trackable products for the scheduled price/stock check. CRON_SECRET-gated
 * (Authorization: Bearer, same as /api/jobs/price-check). The Prisma-free
 * scheduled function GETs this, scrapes each, then POSTs to /api/track/apply.
 *
 * Returns up to 40 active products (not archived/purchased/released), oldest-
 * checked first (nulls first), so each run advances the staleness frontier.
 *
 * Product-scoped, not session-scoped: the sweep spans every user's products so
 * each owner's tracking keeps running. The apply step addresses any resulting
 * notification to the product's owner (see jobs/price-stock buildNotifications).
 */
export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured." },
      { status: 501 },
    );
  }
  if (!authorized(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json(
      { ok: false, error: "No database configured." },
      { status: 503 },
    );
  }

  const products = await prisma.product.findMany({
    where: {
      isArchived: false,
      isPurchased: false,
      releasedAt: null,
    },
    orderBy: [{ lastCheckedAt: { sort: "asc", nulls: "first" } }],
    take: MAX_PRODUCTS,
    select: { id: true, originalUrl: true, storeDomain: true },
  });

  return NextResponse.json({ products });
}
