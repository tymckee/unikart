import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { applyPriceCheck } from "@/lib/jobs/price-stock";

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
 * Internal endpoint: the scheduled function scrapes a live price (slow, Prisma-
 * free via track-compute) and POSTs the result here for a fast Prisma write.
 * CRON_SECRET-gated (Authorization: Bearer, like /api/jobs/price-check).
 *
 * Body: { productId, price: number|null, availability: string }.
 */
export async function POST(req: Request): Promise<Response> {
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

  const body = (await req.json().catch(() => null)) as {
    productId?: string;
    price?: number | null;
    availability?: string;
  } | null;
  if (!body?.productId) {
    return NextResponse.json(
      { ok: false, error: "productId required." },
      { status: 400 },
    );
  }

  try {
    const result = await applyPriceCheck(body.productId, {
      price: typeof body.price === "number" ? body.price : null,
      availability: body.availability || "unknown",
    });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("[track/apply]", e);
    return NextResponse.json({ ok: false, error: "error" }, { status: 500 });
  }
}
