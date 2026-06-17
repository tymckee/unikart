# UniKart — Roadmap & ideas

Phases 0–4 are done (visual foundation, DB + persistence, URL parser, price/stock
tracking, share cards). This captures the founder's idea backlog, triaged by
effort, with recommended tech and cost notes. It's the running "future tasks" list.

## Tech choices (recommendations)

### AI — default to Claude (Anthropic API)
- **Haiku** for cheap, high-volume tasks: description simplification, category
  suggestions, attribute extraction. Pennies-to-fractions-of-a-cent per product.
- **Sonnet** for harder reasoning: multi-step planning, agentic flows.
- **Vision** (Haiku/Sonnet) can read product images directly.
- **Cost control:** run on-demand or at save time, **cache the result per
  product** (never re-run on every page view), prefer Haiku, cap output tokens.
  Small scale = pennies; at scale the lever is caching + batching.

### Background removal (cutouts) — seam already shipped
- **Free / local:** `@imgly/background-removal` (open-source, on-device, no key;
  ~40 MB model — best run in a worker or at save time).
- **Hosted (higher quality, paid):** Photoroom API or remove.bg (~50 free/mo,
  then ~$0.10–0.20/image).
- **Storage:** cutouts need a bucket — **Cloudflare R2** (you already have
  Cloudflare) or S3. This is the one missing piece to turn cutouts on.

### Payments / wallet — Stripe
- Use **Stripe** for saved payment methods + billing addresses. **Never store raw
  card data** (PCI scope you don't want): use Stripe Customer + SetupIntent +
  Stripe Elements; UniKart stores only Stripe IDs.
- Shipping/contact info you *can* store yourself (not PCI), but treat it as
  sensitive personal data (encryption at rest, export/delete already in Settings).

### Price comparison / image search
- No free, reliable, universal price API. Realistic options: Google Shopping
  Content API / SerpAPI (paid), affiliate networks (Amazon PA-API, Skimlinks,
  CJ), or per-retailer parsing. The hard part is **product identity matching**
  across stores (GTIN/UPC or brand+model, often AI-assisted).
- Best-photo selection: collect all candidate images (og:image, JSON-LD, gallery)
  + AI-rank for quality/cleanliness; or an image-search API (paid).

## Backlog by effort

### Near-term — high value, mostly doable now
- **AI "the gist"** — Claude Haiku turns Amazon's clickbait wall-of-text into a
  few clean bullets of the details that matter. Cheap, high impact. *Ready to build.*
- **AI attribute extraction** — pull structured specs (clothing material &
  measurements; furniture dimensions) into a tidy specs card. *Ready-ish.*
- **Auto-organize** — Claude suggests a collection for each save, or a "tidy my
  Hub" pass. *Ready.*
- **Shipping addresses & contact info** — data model + Settings UI. *Doable.*
- **Low-inventory emphasis** — we already track availability; surface "low stock"
  louder and alert on it. ("Find other vendors" is the hard multi-retailer part.)

### Medium — needs a service/key
- **Saved payment methods (Stripe)** + billing addresses.
- **AI image cutouts live** — pick a provider + add R2 storage (seam is ready).
- **Best-photo from multiple sources** — image search API + AI ranking.
- **Measurement / dimension graphics** — visual components fed by extracted specs
  (a shirt/sofa/table diagram annotated with sizes; store color/size options).

### Hard — research / long-term
- **Price comparison across stores → buy from the cheapest** (incl. shipping cost
  & ETA). Needs product matching + price feeds; large.
- **Agentic checkout — "AI buys for you across multiple stores."** Needs real
  merchant/payment integrations or browser automation, plus serious
  compliance/liability work. This is the ACP / agentic-commerce frontier — a
  long-term R&D track. Our Checkout Assistant is the compliant stepping stone.
- **Promo-code finding** (paid feature). Honey-style; codes expire and are
  region-locked, so reliability is genuinely hard — only ship if it can be trusted.

### Not recommended as described
- **Collecting users' logins to other sites to scrape their wishlists.** Storing
  third-party credentials is a security/liability/ToS minefield and likely
  violates those sites' terms. **Safe alternative:** the browser extension
  (Phase 7) reads the wishlist page while the user is already logged in *in their
  own browser* and sends the items to UniKart — **no credential storage** — plus
  user-initiated import of an exported wishlist.

## Suggested next builds
1. Neon Postgres (prod persistence) — see [deploy-postgres.md](deploy-postgres.md).
2. AI "the gist" + attribute extraction (Claude) — biggest visible AI win, cheap.
3. Cutouts live (provider + R2).
4. Shipping/payment (Stripe) wallet.
