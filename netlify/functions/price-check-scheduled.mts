// Netlify Scheduled Function: runs the real price/stock check on a cron. It
// does only the SLOW, Prisma-free work — fetch the trackable products, scrape
// each live price — then POSTs each result to /api/track/apply for a fast
// Prisma write. Keeping Prisma out of here is deliberate: esbuild can't bundle
// Prisma's native client (mirrors enrich-product-background.mts).
//
// Schedule is declared via the modern `config.schedule` export (cron syntax),
// so no netlify.toml [[scheduled]] entry is needed.
import { fetchLivePrice } from "../../src/lib/track-compute";

// Cap total work so a run can't sprawl: at most this many products per tick.
const MAX_PRODUCTS = 40;

type TrackProduct = { id: string; originalUrl: string; storeDomain: string | null };

export default async (): Promise<Response> => {
  const secret = process.env.CRON_SECRET;
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL;
  if (!secret || !base) {
    console.error("[price-check-scheduled] missing CRON_SECRET or URL");
    return new Response("not configured");
  }

  const auth = { Authorization: `Bearer ${secret}` };

  try {
    const res = await fetch(`${base}/api/track/products`, { headers: auth });
    if (!res.ok) {
      console.error(`[price-check-scheduled] products ${res.status}`);
      return new Response("ok");
    }
    const data = (await res.json()) as { products?: TrackProduct[] };
    const products = (data.products ?? []).slice(0, MAX_PRODUCTS);

    for (const p of products) {
      try {
        const next = await fetchLivePrice({
          originalUrl: p.originalUrl,
          storeDomain: p.storeDomain,
        });
        await fetch(`${base}/api/track/apply`, {
          method: "POST",
          headers: { ...auth, "content-type": "application/json" },
          body: JSON.stringify({
            productId: p.id,
            price: next.price,
            availability: next.availability,
          }),
        });
      } catch (e) {
        console.error(`[price-check-scheduled] product ${p.id}`, e);
      }
    }
  } catch (e) {
    console.error("[price-check-scheduled]", e);
  }

  return new Response("ok");
};

// Every 6 hours (modern Netlify scheduled-function config).
export const config = { schedule: "0 */6 * * *" };
