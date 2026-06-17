/**
 * AI background-removal seam.
 *
 * Returns a hosted URL for a transparent-background cutout of the product image,
 * or null to fall back to the raw image (and then the branded gradient tile).
 * Runs best-effort at save time and never blocks a save.
 *
 * Pluggable via CUTOUT_PROVIDER. A real provider needs two things:
 *   1. a background-removal service (remove.bg / Photoroom API, or local
 *      @imgly/background-removal), and
 *   2. blob storage for the result (Cloudflare R2 / S3) to host the cutout.
 * See docs/product-images.md for the full plan, options, and costs.
 */
export async function getCutout(
  sourceUrl: string | null | undefined,
): Promise<string | null> {
  if (!sourceUrl) return null;
  const provider = process.env.CUTOUT_PROVIDER ?? "none";
  try {
    switch (provider) {
      case "removebg":
        return await removeBgCutout(sourceUrl);
      // case "photoroom":  return await photoroomCutout(sourceUrl);
      // case "imgly":      return await imglyCutout(sourceUrl);   // free, local
      default:
        return null; // no-op: cards use the raw image / gradient
    }
  } catch (e) {
    console.error("[cutout] provider failed:", e);
    return null;
  }
}

async function removeBgCutout(sourceUrl: string): Promise<string | null> {
  const key = process.env.REMOVEBG_API_KEY;
  if (!key) return null;
  // remove.bg returns image BYTES, not a URL. A complete implementation uploads
  // the result to blob storage and returns the public URL. Until a bucket is
  // configured we no-op rather than return un-hosted bytes.
  console.warn(
    "[cutout] removebg needs blob storage to host results — see docs/product-images.md",
  );
  return null;
}
