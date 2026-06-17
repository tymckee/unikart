// Netlify Background Function (the "-background" suffix gives it a 15-minute
// budget and an immediate 202 to the caller). saveProduct fires this so the
// slow ScraperAPI scrape + AI normalize run off the 10s request path.
import { enrichProduct } from "../../src/lib/enrich";

export default async (req: Request): Promise<Response> => {
  try {
    const { productId, secret } = (await req.json()) as {
      productId?: string;
      secret?: string;
    };
    if (!secret || secret !== process.env.CRON_SECRET) {
      return new Response("forbidden", { status: 403 });
    }
    if (productId) await enrichProduct(productId);
  } catch (e) {
    console.error("[enrich-bg]", e);
  }
  return new Response("ok");
};
