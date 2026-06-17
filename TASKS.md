# UniKart — Build Tasks

A calm, premium "buying operating system." Save what you want, understand when to buy, and check out with less chaos.

This checklist is organized by the nine build phases. It tracks what is done, what is in progress, and what is still ahead. Future work is labeled clearly. Nothing here claims a shipped feature, a real partnership, or a payment integration that does not exist.

**Legend**

- `[x]` Done
- `[~]` In progress / partially done
- `[ ]` Not started

**Status at a glance**

| Phase | Title | Status |
| --- | --- | --- |
| 0 | Planning and documentation | Done |
| 1 | Visual foundation | In progress |
| 2 | Database and product saving | Not started |
| 3 | URL parser | Not started |
| 4 | Price and stock tracking | Not started |
| 5 | Universal Cart and Checkout Assistant | Not started |
| 6 | Buy Brain | Not started |
| 7 | Extension and share-readiness | Not started |
| 8 | Production polish | Not started |

---

## Phase 0 — Planning and documentation

The thinking is on paper before the building begins. These deliverables are complete.

- [x] `README.md` — clean setup and deploy steps, plus a note that git identity should be the user's personal one (the machine global git currently uses a work email)
- [x] `docs/product-spec.md` — positioning, scope, data models, phase plan
- [x] `docs/design-system.md` — tokens, components, motion, the wheel metaphor
- [x] `docs/architecture.md` — app structure, data-access layer, auth and job abstractions, deploy target
- [x] `docs/future-integrations.md` — placeholder adapters, clearly labeled as planned (no real partnerships)
- [x] `docs/extension-plan.md` — browser extension and share-target plan
- [x] `TASKS.md` — this checklist, organized by phase with acceptance criteria

---

## Phase 1 — Visual foundation

The shell, the language, the feeling. Mocked data only; no database yet. This phase is in progress.

### App shell and routing

- [~] App shell (root layout, frosted top bar, quiet navigation, footer)
- [~] Routes scaffolded for every page:
  - [x] `/` — landing
  - [~] `/sign-in`
  - [~] `/dashboard` — the Hub
  - [~] `/products/[id]`
  - [~] `/collections`
  - [~] `/cart`
  - [~] `/cart/checkout-assistant`
  - [~] `/notifications`
  - [~] `/settings`
  - [~] `/demo`

### Pages

- [~] Landing page — calm hero, the wheel metaphor, quiet value props, no deal-site energy
- [~] Dashboard skeleton (the Hub) with mocked products from `src/lib/mock-data.ts`
- [~] Paste bar on the dashboard (URL input that will later trigger the parser; mocked for now)

### Brand and motion primitives

- [~] `WheelLogo` — thin-line radial wheel mark (hub, spokes, rim); not childish, no cartoon bikes
- [~] `WheelLoader` — spinning thin-line wheel shown while a product URL is parsed
- [~] Card "spoke" indicators — tiny radial marks for price movement, stock, and alert status
- [~] Motion eases and animations wired (`ease-out-soft`, `wheel`, `rise`, `fade`, `shimmer`); respect `prefers-reduced-motion`

### Design tokens

- [~] Design tokens defined in `src/app/globals.css` via Tailwind v4 `@theme` (CSS-first, no `tailwind.config.js`)
  - [x] Fonts (`--font-sans`, `--font-mono`)
  - [x] Surfaces (white, porcelain, canvas, mist, fog)
  - [x] Metals (titanium, silver, slate, graphite, ink, obsidian)
  - [x] Hairlines (`line`, `line-strong`)
  - [x] Accent (`accent` #0071e3, `accent-strong` #0a84ff, `accent-ink` #0058b0, `accent-soft` #eaf2fe)
  - [x] Semantics (down / up / warn, each with a soft variant)
  - [x] Radii (sm through 3xl)
  - [x] Shadows (soft, lift, float) and frosted glass (`.glass`, `.glass-strong`)

### Component library

- [~] `GlassCard` — frosted, hairline-bordered surface
- [~] `Pill` — compact status / tag
- [~] `Button` — primary, secondary, quiet variants
- [~] `Input` — text and URL inputs (used by the paste bar)
- [~] `EmptyState` — calm zero-data states
- [~] `SegmentedControl` — quiet tabbed control

### Responsiveness

- [~] Responsive layout across mobile, tablet, and desktop
- [~] Touch targets and spacing tuned for small screens
- [ ] PWA metadata stub for future mobile (manifest, icons)

### Domain scaffolding (already present)

- [x] `src/lib/types.ts` — domain types mirroring the planned Prisma models 1:1
- [x] `src/lib/mock-data.ts` — mocked products, collections, and price history
- [x] `src/lib/utils.ts` — `cn` helper (clsx + tailwind-merge)
- [x] `src/lib/buy-brain.ts` — Buy Brain stub scaffolded for Phase 6

---

## Phase 2 — Database and product saving

Move from mocks to a real, persistent store. Built around trust; shopping data is sensitive.

### Prisma and data access

- [ ] Add Prisma with SQLite locally (minimal friction); `DATABASE_URL` in `.env`
- [ ] Architect for a provider swap to Postgres later (provider + `DATABASE_URL` only)
- [ ] Define Prisma schema mirroring `src/lib/types.ts`: `User`, `Product`, `Collection`, `ProductCollection`, `PriceSnapshot`, `StockSnapshot`, `AlertRule`, `Notification`, `UniversalCart`, `UniversalCartItem`, `CheckoutStep`, `IntegrationAdapter`
- [ ] Repository / data-access layer that abstracts Prisma (UI never imports Prisma directly)
- [ ] Seed script using the existing mock data so the Hub looks identical on first run
- [ ] Initial migration and a documented reset command

### Auth abstraction

- [ ] Simple auth abstraction for Phase 1/2 (mock single-user session)
- [ ] Structure it to drop in Auth.js (NextAuth v5) later without touching feature code
- [ ] `/sign-in` wired to the mock session

### Saving and managing products

- [ ] Save a product (manual entry path) and persist it
- [ ] Product list on the Hub reads from the database
- [ ] Product detail page (`/products/[id]`) reads from the database
- [ ] Edit product fields (title, notes, price, availability, image)
- [ ] Archive and un-archive (`isArchived`)
- [ ] Mark purchased / un-purchase (`isPurchased`, `purchasedAt`)
- [ ] Collections ("Spokes"): create, rename, reorder, assign products
- [ ] `/collections` reads and writes real data

### Privacy foundations

- [ ] Export my data
- [ ] Delete a product and its history
- [ ] Delete account (removes all associated data)

---

## Phase 3 — URL parser

Paste a link, get a clean product. Respectful fetches only.

### Parser pipeline (in priority order)

- [ ] 1) JSON-LD `schema.org/Product`
- [ ] 2) Open Graph tags
- [ ] 3) Twitter card tags
- [ ] 4) Common ecommerce meta tags
- [ ] 5) HTML `title` / image fallback
- [ ] 6) Manual entry fallback

### Output and confidence

- [ ] Normalize to: `title`, `description`, `imageUrl`, `price`, `currency`, `availability`, `brand`, `sku`, `canonicalUrl`, `storeDomain`, `confidence`, `rawMetadata`
- [ ] Set `metadataConfidence` (high | medium | low) from which strategy succeeded
- [ ] Surface low-confidence results clearly and offer manual correction

### Integration and UX

- [ ] Wire the dashboard paste bar to the parser
- [ ] Show `WheelLoader` while a URL is parsed
- [ ] Confirmation step before saving (review and edit parsed fields)
- [ ] Mock adapters for pages where a real fetch fails or is blocked

### Constraints (must hold)

- [ ] Do not bypass anti-bot systems
- [ ] Do not ask for store credentials
- [ ] Do not store payment cards
- [ ] No aggressive scraping; respectful, rate-limited fetches
- [ ] Honor robots and reasonable request etiquette

---

## Phase 4 — Price and stock tracking

Understand the trend, not just the number. MVP simulates the background job.

### Snapshots and history

- [ ] Record `PriceSnapshot` and `StockSnapshot` rows on each check
- [ ] Maintain `currentPrice`, `previousPrice`, `lowestPrice`, `highestPrice`, `availability`, `lastCheckedAt`
- [ ] Custom lightweight SVG price chart (no heavy dependency; Recharts optional later)
- [ ] Spoke indicators reflect real price movement and stock state

### Alerts

- [ ] `AlertRule` types: price drop, price rise, target price, back in stock, out of stock
- [ ] Set and edit a target price per product
- [ ] Enable / disable alerts per product
- [ ] Generate `Notification` rows when a rule fires
- [ ] `/notifications` reads real notifications; mark read / unread

### Job abstraction

- [ ] Job abstraction for background price/stock checks (pluggable)
- [ ] MVP "Run check now" manual action that simulates a scheduled run
- [ ] Document how real cron/queue drops in later (no real scheduler in MVP)

---

## Phase 5 — Universal Cart and Checkout Assistant

Group, verify, and check out in sequence. The MVP does **not** do one-tap cross-retailer purchase.

### Universal Cart

- [ ] Add and remove products from the `UniversalCart`
- [ ] Quantity per item
- [ ] `/cart` shows cart total and per-merchant subtotals
- [ ] Group cart items by merchant (`storeDomain`)

### Checkout Assistant (sequential, user-driven)

- [ ] Build `CheckoutStep` rows grouped by merchant
- [ ] Verify latest known price and stock before each step
- [ ] Open each merchant checkout / product page in sequence (`checkoutUrl`)
- [ ] User marks each step complete; status moves pending → ready → opened → completed
- [ ] Completed items move to the Purchased archive
- [ ] "Rim" progress ring (wheel-rim) shows checkout completion

### Future adapters (placeholders only — clearly labeled, no real partnerships)

- [ ] Shopify `checkoutUrl` adapter — placeholder
- [ ] Stripe saved payment — placeholder
- [ ] BNPL partner — **text only**, no Klarna/Affirm logos, no real partnership
- [ ] ACP / agentic commerce — placeholder
- [ ] `IntegrationAdapter` records marked `planned` with honest descriptions

### Constraints (must hold)

- [ ] No real payment processing in the MVP
- [ ] No one-tap cross-retailer purchase
- [ ] No fake partnerships or partner logos

---

## Phase 6 — Buy Brain

A calm verdict: Buy, Wait, or Watch. Deterministic first; AI later.

- [ ] Deterministic engine in `src/lib/buy-brain.ts` using:
  - [ ] Stock / availability
  - [ ] Current price vs. lowest price
  - [ ] Recent average price
  - [ ] Volatility
  - [ ] Target price
  - [ ] Cart total
- [ ] Output a `BuyVerdict` (buy | wait | watch) with a short, human rationale
- [ ] Show the verdict on the product detail page
- [ ] Show a cart-level read in the Checkout Assistant
- [ ] Pro-tier gating hook (Buy Brain is a Pro feature)
- [ ] Architect so the deterministic core can be swapped for AI later (same interface)

---

## Phase 7 — Extension and share-readiness

Save from anywhere. Save target first; full extension follows.

- [ ] PWA share target so a shared URL lands in the paste / save flow
- [ ] Browser extension MVP: a "Save to UniKart" action on a product page
- [ ] Extension talks to the same API the web app uses
- [ ] Save flow shows confidence and lets the user correct fields
- [ ] Document store-listing requirements and permissions (least privilege)
- [ ] Honor the same parser constraints (respectful fetch, no credential prompts)

---

## Phase 8 — Production polish

Make it quiet, fast, and trustworthy.

### Trust and compliance

- [ ] Affiliate disclosure copy in Settings and the footer (ready, honest, "may earn commission in future" language)
- [ ] Privacy controls visible and working: export data, delete account, delete product history
- [ ] Clear statement that no payment cards are stored and no real payment processing occurs
- [ ] Monetization-ready tiers surfaced honestly: Free, Pro, Affiliate (disclosed), Partner checkout (future)

### Quality

- [ ] Empty, loading, and error states for every route
- [ ] Accessibility pass (focus order, contrast, labels, keyboard paths)
- [ ] `prefers-reduced-motion` honored everywhere
- [ ] Performance pass (image handling, bundle size, no heavy chart dep)
- [ ] Lint and type-check clean (`npm run lint`, `tsc`)
- [ ] SEO and Open Graph metadata for public pages

### Deploy

- [ ] Deploy to Netlify (the user's personal account)
- [ ] Confirm `DATABASE_URL` and environment configuration on Netlify
- [ ] Confirm git identity is the user's **personal** account (not the work email currently set globally)
- [ ] Final README pass: setup, deploy, and the personal-git-identity note

---

## Acceptance criteria

The build is on track when the following hold.

### Brand and tone

- [ ] The product reads as calm and premium — no ecommerce hype, no deal-site energy, no clutter
- [ ] The wheel metaphor is quiet and consistent: hub, spokes, rim; thin-line logo; no cartoon bikes
- [ ] Collections are surfaced as "Spokes" and the cart progress is the "Rim"
- [ ] Accent blue (#0071e3) is used sparingly

### Foundation (Phases 1–2)

- [ ] All ten routes exist and navigate cleanly
- [ ] Design tokens are defined only in `src/app/globals.css` via Tailwind v4 `@theme` (no `tailwind.config.js`)
- [ ] The component library (GlassCard, Pill, Button, Input, EmptyState, SegmentedControl) is used consistently
- [ ] `WheelLogo` and `WheelLoader` are in place; motion respects `prefers-reduced-motion`
- [ ] UI built on mock data maps 1:1 to the database with no view-model changes
- [ ] Prisma is abstracted behind a data-access layer; UI never imports Prisma directly
- [ ] SQLite locally with a clean path to Postgres (provider + `DATABASE_URL` swap)

### Features (Phases 3–6)

- [ ] The parser follows the six-strategy order and sets `metadataConfidence` honestly
- [ ] Price and stock history render in the custom SVG chart with accurate spoke indicators
- [ ] "Run check now" simulates a scheduled job; the real scheduler is pluggable
- [ ] The Checkout Assistant groups by merchant, verifies price/stock, opens pages in sequence, and uses the Rim ring
- [ ] Buy Brain returns a deterministic Buy / Wait / Watch with a human rationale

### Trust and constraints (must never break)

- [ ] No real payment processing; no stored payment cards
- [ ] No fake partnerships and no partner logos (BNPL is text only)
- [ ] No one-tap cross-retailer purchase in the MVP
- [ ] No anti-bot bypass, no credential prompts, no aggressive scraping
- [ ] Affiliate disclosure and privacy controls (export, delete account, delete product history) are present and working

### Ship

- [ ] Lint and type-check pass; key routes have working empty / loading / error states
- [ ] Deploys to the user's personal Netlify from the user's personal GitHub
- [ ] Git identity is the user's personal one, and the README documents setup, deploy, and that note
