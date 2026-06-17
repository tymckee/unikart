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
