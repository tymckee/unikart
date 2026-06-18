import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { sendDueDigests } from "@/lib/jobs/digest";

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
 * Internal endpoint: send any due notification email digests. The hourly
 * scheduled Netlify function (Prisma-free) POSTs here; this route does the
 * Prisma + Resend work (the "split" pattern, like /api/track/apply).
 * CRON_SECRET-gated (Authorization: Bearer).
 *
 * Body (all optional): { batch?: number, dryRun?: boolean }. `dryRun` resolves
 * who WOULD receive a digest without sending or claiming anything — safe to
 * probe in any environment.
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
    batch?: number;
    dryRun?: boolean;
  } | null;

  try {
    const result = await sendDueDigests({
      batch: typeof body?.batch === "number" ? body.batch : undefined,
      dryRun: body?.dryRun === true,
    });
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    console.error("[notifications/digest/run]", e);
    return NextResponse.json({ ok: false, error: "error" }, { status: 500 });
  }
}
