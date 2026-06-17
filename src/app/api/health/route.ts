import { NextResponse } from "next/server";
import { hasDatabase, prisma } from "@/lib/db";
import { getAuthorizedOpsViewer } from "@/lib/ops/viewer";

export const dynamic = "force-dynamic";

/**
 * Health endpoint. Public callers get a minimal, non-sensitive status. An
 * authenticated Ops operator gets a few extra (still non-secret) operational
 * details (deploy hash, environment, DB latency). No secrets are ever returned.
 */
async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number | null }> {
  if (!hasDatabase()) return { ok: false, latencyMs: null };
  const start = Date.now();
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2500)),
    ]);
    return { ok: true, latencyMs: Date.now() - start };
  } catch {
    return { ok: false, latencyMs: Date.now() - start };
  }
}

export async function GET() {
  const db = await checkDatabase();
  const healthy = !hasDatabase() || db.ok;

  // Minimal, safe-for-anyone payload.
  const base = {
    status: healthy ? ("ok" as const) : ("degraded" as const),
    service: "unikart",
    time: new Date().toISOString(),
  };

  // Authorized operators see a little more — still nothing sensitive.
  const viewer = await getAuthorizedOpsViewer().catch(() => null);
  if (viewer) {
    return NextResponse.json(
      {
        ...base,
        environment: process.env.NODE_ENV ?? "unknown",
        database: { configured: hasDatabase(), ok: db.ok, latencyMs: db.latencyMs },
        deploy: {
          commit:
            process.env.COMMIT_REF?.slice(0, 8) ??
            process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 8) ??
            null,
          context: process.env.CONTEXT ?? null,
        },
      },
      { headers: { "cache-control": "no-store" } },
    );
  }

  return NextResponse.json(base, {
    status: healthy ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
