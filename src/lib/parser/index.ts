import { extractProduct } from "./extract";
import { scrapeRender, scrapeStructured } from "./scrape";
import { simulateParse, type ParsePreview } from "../parse-preview";

const USER_AGENT =
  "UniKartBot/1.0 (+https://uni-kart.com; saves a product preview on user request)";
const FETCH_TIMEOUT_MS = 9000;
const MAX_HTML_BYTES = 2_000_000;

function normalize(raw: string): string {
  const t = raw.trim();
  return t.includes("://") ? t : `https://${t}`;
}

function isPublicIPv4(ip: string): boolean {
  const octets = ip.split(".");
  if (octets.length !== 4) return false;
  // Reject octal-style leading zeros (the OS resolver may read them as octal).
  if (octets.some((o) => o.length > 1 && o.startsWith("0"))) return false;
  const p = octets.map(Number);
  if (p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = p;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 169 && b === 254) return false; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  return true;
}

/**
 * Only fetch public http(s) URLs. Blocks localhost, private/reserved/link-local
 * ranges, cloud metadata, and IPv6 loopback/ULA/link-local plus IPv4-mapped and
 * numeric-encoded hosts. Every redirect hop is re-validated in fetchHtml.
 * (DNS-rebinding via a public name resolving to a private IP is a known residual
 * risk for this single-user app.)
 */
export function isSafePublicUrl(u: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(u);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return false;
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    return false;
  }

  // Decimal / hex numeric host (e.g. 2130706433, 0x7f000001).
  if (/^(0x[0-9a-f]+|\d+)$/i.test(host)) return false;

  // IPv4 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return isPublicIPv4(host);

  // IPv6 literal
  if (host.includes(":")) {
    const mappedV4 = host.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
    if (mappedV4) return isPublicIPv4(mappedV4[1]);
    const mappedHex = host.match(/::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16);
      const lo = parseInt(mappedHex[2], 16);
      return isPublicIPv4(
        `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`,
      );
    }
    if (host === "::1" || host === "::") return false; // loopback / unspecified
    if (/^f[cd]/.test(host)) return false; // unique-local fc00::/7
    if (/^fe[89ab]/.test(host)) return false; // link-local fe80::/10
    return true;
  }

  return true; // DNS hostname
}

async function fetchHtml(startUrl: string): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    let current = startUrl;
    // Follow redirects manually so every hop passes the SSRF check (a public
    // host could otherwise 30x-redirect to an internal address).
    for (let hop = 0; hop < 5; hop++) {
      if (!isSafePublicUrl(current)) return null;
      const res = await fetch(current, {
        signal: ctrl.signal,
        redirect: "manual",
        headers: {
          "User-Agent": USER_AGENT,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return null;
        current = new URL(loc, current).toString();
        continue;
      }
      if (!res.ok) return null;
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (!ct.includes("html") && !ct.includes("xml")) return null;
      return (await res.text()).slice(0, MAX_HTML_BYTES);
    }
    return null; // too many redirects
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read a product from a live page. Respectful: identifies itself, fetches once
 * with a timeout, never bypasses anti-bot systems, and falls back to a
 * URL-based heuristic (the mock adapter) when the page can't be read.
 */
/** A result is worth keeping if it has any real signal (not the bare fallback). */
function isUsable(r: ParsePreview | null): r is ParsePreview {
  return Boolean(
    r && (r.price != null || r.imageUrl || r.title !== `${r.storeName} product`),
  );
}

function safeExtract(html: string, url: string): ParsePreview | null {
  try {
    return extractProduct(html, url);
  } catch {
    return null;
  }
}

export async function parseProduct(rawUrl: string): Promise<ParsePreview> {
  const url = normalize(rawUrl);
  if (!isSafePublicUrl(url)) return simulateParse(rawUrl);

  // 1. Amazon → ScraperAPI structured endpoint (fast, free, clean JSON incl.
  //    real price/image). No-op without SCRAPERAPI_KEY.
  const structured = await scrapeStructured(url);
  if (structured) return structured;

  // 2. Polite direct fetch first (free, fast) — works for cooperative sites.
  const directHtml = await fetchHtml(url);
  const direct = directHtml ? safeExtract(directHtml, url) : null;
  if (isUsable(direct)) return direct;

  // 3. Polite fetch got nothing usable (blocked / price stripped) → ScraperAPI
  //    render, then parse the JS-rendered HTML. No-op without a key, and
  //    protected sites needing premium proxies (paid) simply return null here.
  const renderedHtml = await scrapeRender(url);
  const rendered = renderedHtml ? safeExtract(renderedHtml, url) : null;
  if (isUsable(rendered)) return rendered;

  // 4. Nothing usable anywhere → honest URL-only fallback (no fabricated price).
  return simulateParse(rawUrl);
}

export { extractProduct };
