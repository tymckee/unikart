import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { runPriceStockCheck } from "@/lib/jobs/price-stock";

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
 * Scheduled price/stock check endpoint — the seam a real cron plugs into
 * (e.g. a Netlify Scheduled Function or cron-job.org hitting this URL).
 *
 *   curl -X POST https://uni-kart.com/api/jobs/price-check \
 *        -H "Authorization: Bearer $CRON_SECRET"
 *
 * Protected by CRON_SECRET so it can't be triggered anonymously.
 */
async function handle(req: Request) {
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
  const summary = await runPriceStockCheck();
  return NextResponse.json({ ok: true, summary });
}

export const POST = handle;
export const GET = handle;
