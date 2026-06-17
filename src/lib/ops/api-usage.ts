/**
 * UniKart Ops — first-party API usage telemetry.
 *
 * `recordApiUsage()` logs one APIUsageEvent per notable request (internal route,
 * parser call, provider call, etc.) so the API Usage + Costs dashboards have
 * real data. Never logs request bodies or anything sensitive.
 *
 * Best-effort — never throws into the caller.
 */
import { hasDatabase, prisma } from "../db";
import { hashIp } from "./request-context";
import { safeJson } from "./sanitize";

export interface ApiUsageInput {
  route: string;
  method?: string;
  statusCode?: number;
  durationMs?: number | null;
  requestId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  userId?: string | null;
  source?: "internal" | "extension" | "provider" | "cron";
  provider?: string | null;
  operation?: string | null;
  quantity?: number | null;
  unit?: string | null;
  estimatedCostUsd?: number | null;
  metadata?: Record<string, unknown> | null;
}

export async function recordApiUsage(input: ApiUsageInput): Promise<void> {
  if (!hasDatabase()) return;
  try {
    await prisma.aPIUsageEvent.create({
      data: {
        route: input.route,
        method: input.method ?? "GET",
        statusCode: input.statusCode ?? 200,
        durationMs: input.durationMs ?? null,
        requestId: input.requestId ?? null,
        ipHash: hashIp(input.ip),
        userAgent: input.userAgent?.slice(0, 500) ?? null,
        userId: input.userId ?? null,
        source: input.source ?? "internal",
        provider: input.provider ?? null,
        operation: input.operation ?? null,
        quantity: input.quantity ?? null,
        unit: input.unit ?? null,
        estimatedCostUsd: input.estimatedCostUsd ?? null,
        metadataJson: safeJson(input.metadata),
      },
    });
  } catch (e) {
    console.error("[ops] recordApiUsage failed:", e);
  }
}

/**
 * Wrap an async unit of work, timing it and recording usage automatically.
 * Returns the work's result; records duration + status regardless of outcome.
 */
export async function withApiUsage<T>(
  base: Omit<ApiUsageInput, "durationMs" | "statusCode">,
  work: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await work();
    void recordApiUsage({ ...base, durationMs: Date.now() - start, statusCode: 200 });
    return result;
  } catch (e) {
    void recordApiUsage({ ...base, durationMs: Date.now() - start, statusCode: 500 });
    throw e;
  }
}
