import { isSafePublicUrl } from "./parser";

/**
 * AI background-removal seam.
 *
 * Returns a URL for a transparent-background cutout of the product image, or
 * null to fall back to the raw image (and then the branded gradient tile).
 * Runs best-effort at save time and never blocks a save.
 *
 * Providers (CUTOUT_PROVIDER):
 *   - "imgly"   : on-device removal (free, no key). Writes to /public/cutouts.
 *                 LOCAL DEV ONLY — serverless hosts have a read-only FS.
 *   - "removebg": hosted API (needs REMOVEBG_API_KEY + blob storage; stub).
 *   - "none"    : no-op.
 * Default: "imgly" in development, "none" in production.
 * See docs/product-images.md.
 */
export async function getCutout(
  sourceUrl: string | null | undefined,
): Promise<string | null> {
  if (!sourceUrl) return null;
  if (!isSafePublicUrl(sourceUrl)) return null; // don't fetch private/SSRF targets

  const provider =
    process.env.CUTOUT_PROVIDER ??
    (process.env.NODE_ENV !== "production" ? "imgly" : "none");

  try {
    switch (provider) {
      case "imgly":
        return await imglyCutout(sourceUrl);
      case "removebg":
        return await removeBgCutout(sourceUrl);
      default:
        return null;
    }
  } catch (e) {
    console.error("[cutout] provider failed:", e);
    return null;
  }
}

async function imglyCutout(sourceUrl: string): Promise<string | null> {
  // /public is read-only on serverless hosts — this path is local-dev only.
  if (process.env.NODE_ENV === "production") return null;

  const path = await import("node:path");
  const fs = await import("node:fs/promises");
  const crypto = await import("node:crypto");

  const hash = crypto
    .createHash("sha256")
    .update(sourceUrl)
    .digest("hex")
    .slice(0, 16);
  const dir = path.join(process.cwd(), "public", "cutouts");
  const filePath = path.join(dir, `${hash}.png`);
  const publicUrl = `/cutouts/${hash}.png`;

  // Cache by source hash — never reprocess the same image.
  try {
    await fs.access(filePath);
    return publicUrl;
  } catch {
    /* not cached yet */
  }

  let removeBackground: (input: Blob) => Promise<Blob>;
  try {
    ({ removeBackground } = (await import(
      "@imgly/background-removal-node"
    )) as unknown as { removeBackground: (input: Blob) => Promise<Blob> });
  } catch {
    console.warn("[cutout] @imgly/background-removal-node not installed");
    return null;
  }

  // Fetch the source image (bounded in time + size, redirects re-validated),
  // then remove the background. imgly needs a typed Blob to detect the format.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  let fetched: { bytes: Uint8Array<ArrayBuffer>; contentType: string } | null;
  try {
    fetched = await fetchImageBytes(sourceUrl, ctrl.signal);
  } finally {
    clearTimeout(timer);
  }
  if (!fetched) return null;
  const input = new Blob([fetched.bytes], { type: fetched.contentType });

  // imgly's ONNX inference exposes no abort hook, so bound it with a race —
  // a pathological image can't stall the inline save indefinitely. (A timed-out
  // inference keeps running in the background until it finishes, then is GC'd.)
  let raceTimer: ReturnType<typeof setTimeout> | undefined;
  let blob: Blob;
  try {
    blob = await Promise.race([
      removeBackground(input),
      new Promise<never>((_, reject) => {
        raceTimer = setTimeout(
          () => reject(new Error("cutout inference timed out")),
          60000,
        );
      }),
    ]);
  } finally {
    if (raceTimer) clearTimeout(raceTimer);
  }

  const out = Buffer.from(await blob.arrayBuffer());
  if (out.byteLength === 0) return null;

  await fs.mkdir(dir, { recursive: true });
  // Atomic publish: write to a temp file then rename. The cache check is
  // existence-only, so a crash mid-write must never leave a partial PNG that
  // gets trusted forever. rename() is atomic on the same filesystem.
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  try {
    await fs.writeFile(tmpPath, out);
    await fs.rename(tmpPath, filePath);
  } catch (e) {
    await fs.rm(tmpPath, { force: true }).catch(() => {});
    throw e;
  }
  return publicUrl;
}

const MAX_IMAGE_BYTES = 8_000_000; // 8 MB cap on a downloaded product image
const MAX_REDIRECTS = 5;

/**
 * Fetch image bytes safely: follow redirects manually so every hop is
 * re-validated by isSafePublicUrl (a public host could otherwise 30x-redirect
 * to an internal address — mirrors the parser's fetchHtml guard), require an
 * image content-type, and enforce a size cap while streaming so a lying
 * Content-Length can't exhaust memory. Returns null on any violation.
 */
async function fetchImageBytes(
  startUrl: string,
  signal: AbortSignal,
): Promise<{ bytes: Uint8Array<ArrayBuffer>; contentType: string } | null> {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isSafePublicUrl(url)) return null;
    const res = await fetch(url, { signal, redirect: "manual" });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return null;
      url = new URL(loc, url).toString();
      continue;
    }

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (!res.ok || !ct.includes("image")) return null;

    const declared = Number(res.headers.get("content-length") || "0");
    if (declared > MAX_IMAGE_BYTES) return null;

    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(new ArrayBuffer(total));
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.byteLength;
    }
    return { bytes, contentType: ct };
  }
  return null; // too many redirects
}

async function removeBgCutout(sourceUrl: string): Promise<string | null> {
  const key = process.env.REMOVEBG_API_KEY;
  if (!key) return null;
  // remove.bg returns image BYTES — a full impl uploads the result to blob
  // storage (Cloudflare R2 / S3) and returns the public URL. Until a bucket is
  // configured we no-op rather than return un-hosted bytes.
  console.warn(
    "[cutout] removebg needs blob storage (R2/S3) to host results — see docs/product-images.md. Source:",
    sourceUrl,
  );
  return null;
}
