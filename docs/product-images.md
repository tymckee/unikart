# Product images & AI cutouts

UniKart aims for a calm, premium shopping feel — product shots that **float** on
a clean surface, with no busy merchant backgrounds. This doc describes how
images flow through the app today and the plan for AI background removal.

## Today (Phase 1–2)

- Mock/seed products have **no real image** (`imageUrl = null`). The UI renders a
  calm, category-tinted **gradient tile** with a monogram (see
  `src/components/product/ProductTile.tsx` and `src/lib/og.tsx`). This is the
  intentional fallback and already reads as "clean / backgroundless."
- Share cards (`/opengraph-image`, `/twitter-image`, and the per-product
  variants under `src/app/(app)/products/[id]/`) use the same logic: a real image
  when present, otherwise the gradient tile.

## Image source seam

`cardImageUrl(product)` in `src/lib/og.tsx` is the single decision point:

```ts
cutoutUrl ?? imageUrl ?? null
```

- `imageUrl` — the raw product photo (populated by the URL parser in Phase 3 from
  `og:image` / JSON-LD).
- `cutoutUrl` — a **background-removed** version (see below). Preferred when set.
- `null` — draw the branded gradient tile.

## Retailer photo coverage (Phase 3)

`imageUrl` is filled by the parser at save time and by background enrichment
after. Three fetch strategies, cheapest/most-reliable first (see
`src/lib/parser/scrape.ts`):

1. **Structured endpoints** — `scrapeStructured` dispatches by domain to
   ScraperAPI's per-retailer JSON APIs. **Amazon** (keyed by ASIN — also decoded
   from `/sspa/click` sponsored-ad and `a.co` short links) and **Walmart** (keyed
   by the `/ip/.../<id>` item id). These bypass every bot wall and return a clean
   photo + price + stock. Bulletproof and IP-independent.
2. **Direct fetch** — a polite `UniKartBot` GET + `extractProduct` (JSON-LD →
   Open Graph → meta). Free. Works for cooperative sites that serve OG/JSON-LD to
   crawlers. Coverage is **IP-dependent** (a retailer may serve our server's IP
   but block another), so it's best-effort, not a guarantee.
3. **Rendered fetch** — `scrapeRender` (ScraperAPI `render=true`). Catches
   JS-rendered cooperative sites the direct fetch misses (eBay, Urban Outfitters).
   A render is slow (30–60s), so enrichment passes a ~55s timeout — the old 8s cap
   silently killed every render fallback.

**The extractor is never the bottleneck** — whenever we obtain real HTML it finds
the image. The limit is *getting past the bot wall*.

### What works vs. what's blocked (measured against the top ~50 US retailers)

| Bucket | Path | Retailers |
|---|---|---|
| **Reliable** | structured / render | Amazon, Walmart, eBay, Urban Outfitters |
| **Likely** (cooperative OG, IP-dependent) | direct fetch | Apple, Target, Nike, Samsung, Dell, IKEA, Newegg, PetSmart, Williams-Sonoma, Ulta, Zappos, Abercrombie, American Eagle, Ace Hardware, Dyson, Glossier |
| **Blocked** (hard Akamai / PerimeterX / DataDome) | needs residential proxies | Best Buy, Home Depot, Lowe's, Costco, Wayfair, Etsy, Macy's, Kohl's, Chewy, Nordstrom, Gap, B&H, GameStop, Microsoft, North Face, Bath & Body Works, Tractor Supply, QVC, Saks, Crate & Barrel, Sephora, Lululemon, Adidas, Anthropologie, Petco, AutoZone, LEGO, REI, Patagonia, HP, Staples |

The **blocked** tier (~31 retailers) cannot be scraped on ScraperAPI's
default/datacenter plan — their walls reject datacenter proxies (`HTTP 500
"…may require adding premium=true"`). The premium/residential proxy pool is a
**paid plan**. The code is wired for it: set `SCRAPERAPI_PREMIUM=ultra` and
`scrapeRender` escalates to residential proxies on failure (one extra call, only
when a plain render fails) — no code change needed after upgrading. Until then,
these retailers degrade gracefully to the branded gradient tile (honest, on-brand:
a blank/branded image beats a fabricated one).

## AI background removal (planned)

Goal: when a product photo exists, produce a transparent-background **cutout** so
the product floats on UniKart's porcelain surface (Apple-store aesthetic) instead
of showing the merchant's lifestyle/background clutter.

**Where it runs:** at **save/parse time** (Phase 3), not at card-render time —
background removal is too slow/expensive to run on every social-card request.
When a product is saved, enqueue a cutout job; store the result as
`Product.cutoutUrl`; cards then pick it up automatically via `cardImageUrl`.

**Schema:** add `cutoutUrl String?` to the `Product` model and a migration.

**Provider options (pluggable behind one `getCutout(imageUrl)` function):**

| Provider | Notes |
|---|---|
| `@imgly/background-removal-node` | Open-source, runs locally (ONNX). No API key, but a ~40 MB model + native runtime; best for a worker/server job, not serverless. |
| remove.bg API | Hosted, high quality, simple HTTP. Needs an API key + per-image cost. |
| Cloudflare Images / Workers AI | Hosted; fits the existing Cloudflare account; good for storage + transforms. |

**Storage:** cutouts (PNG with alpha) are written to a blob store (Cloudflare R2 /
Images, S3, or similar) and the public URL saved to `cutoutUrl`. UniKart never
hot-links or rehosts without the cutout step succeeding — on failure we fall back
to `imageUrl`, then the gradient.

**Privacy & cost:** only run on user-saved products; cache by source-image hash to
avoid reprocessing; respect merchant image rights (we display, we don't claim
ownership). Background removal is a presentation enhancement, never required.

## Rollout

1. Phase 3 parser fills `imageUrl`.
2. Add `Product.cutoutUrl` + a `getCutout` adapter (default no-op → returns input).
3. Enable a provider via env (`CUTOUT_PROVIDER`, key); run the job on save.
4. Cards and tiles automatically upgrade to floating cutouts.
