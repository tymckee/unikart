import { applyEnrichment } from "@/lib/enrich";
import type { EnrichmentFields } from "@/lib/enrich-compute";

export const dynamic = "force-dynamic";

/**
 * Internal endpoint: the background function computes enrichment (slow, Prisma-
 * free) and POSTs the result here for a fast Prisma write. CRON_SECRET-gated.
 */
export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as {
    productId?: string;
    fields?: EnrichmentFields;
    secret?: string;
  } | null;

  const secret = process.env.CRON_SECRET;
  if (!body || !secret || body.secret !== secret) {
    return new Response("forbidden", { status: 403 });
  }
  if (body.productId && body.fields) {
    try {
      await applyEnrichment(body.productId, body.fields);
    } catch (e) {
      console.error("[enrich/apply]", e);
      return new Response("error", { status: 500 });
    }
  }
  return new Response("ok");
}
