// Netlify Background Function (the "-background" suffix gives a 15-minute budget
// + an immediate 202). It does only the SLOW, Prisma-free work — scrape + AI —
// then POSTs the result to /api/enrich/apply for a fast Prisma write. Keeping
// Prisma out of here is deliberate: esbuild can't bundle Prisma's native client.
import { computeEnrichment } from "../../src/lib/enrich-compute";

export default async (req: Request): Promise<Response> => {
  try {
    const body = (await req.json()) as {
      productId?: string;
      originalUrl?: string;
      title?: string;
      brand?: string | null;
      category?: string | null;
      storeName?: string | null;
      secret?: string;
    };
    const secret = process.env.CRON_SECRET;
    if (!secret || body.secret !== secret) {
      return new Response("forbidden", { status: 403 });
    }
    if (body.productId && body.originalUrl) {
      const fields = await computeEnrichment({
        originalUrl: body.originalUrl,
        title: body.title ?? "",
        brand: body.brand,
        category: body.category,
        storeName: body.storeName,
      });
      const base = process.env.URL || process.env.DEPLOY_PRIME_URL;
      if (base) {
        await fetch(`${base}/api/enrich/apply`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productId: body.productId, fields, secret }),
        });
      }
    }
  } catch (e) {
    console.error("[enrich-bg]", e);
  }
  return new Response("ok");
};
