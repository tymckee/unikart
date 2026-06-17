# UniKart — Product Specification

> A calm buying operating system. Save what you want, understand when to buy, and check out with less chaos.

**Status:** Living document. Phase 1 (UI on mock data) is the current build target. Sections labeled _Planned_, _Future_, or with a phase tag describe work that is not yet shipped.
**Audience:** Engineering, design, and the project owner (a personal project, separate from work).
**Last reviewed:** 2026-06-16.

---

## 1. Vision and positioning

UniKart is a premium, Apple-inspired product-saving and universal-cart app. It is the quiet place where the things you want to buy live — and where you find out _when_ to buy them.

**It is not a wishlist.** A wishlist is a pile. UniKart is a system:

- **Save** what you want from anywhere, with one paste.
- **Understand** when to buy, from price history, stock, and a simple verdict.
- **Check out** across stores with less chaos, one merchant at a time.

The product is deliberately calm. There is no deal-site energy, no countdown clocks, no manufactured urgency. The signal — a real price drop, a real return to stock, a target you set — is the only thing that raises its voice.

### Who it is for

A thoughtful buyer who saves things across many stores, wants to time purchases well, and dislikes the noise of typical shopping tools. One person, many tabs, many carts — UniKart unifies them.

### What success looks like

- Saving a product takes one paste and feels instant.
- The buyer trusts the price history and the Buy / Wait / Watch verdict.
- The Universal Cart turns a scattered checkout into a short, ordered list.
- Nothing feels like an ad. The interface earns trust because it is honest about what it knows and does not know.

---

## 2. Brand and metaphor

The brand is built on a single quiet metaphor: **the bike wheel**. Hub, spokes, rim, motion, balance. It is thin-lined and engineered, never childish. There are **no cartoon bikes** and no playful illustration of cycling. The energy is Apple Wallet + Apple Store + iCloud + the fitness rings — restrained, tactile, precise.

| Metaphor element | Meaning in product | Where it appears |
| --- | --- | --- |
| **Hub** | The center of everything you are tracking | The dashboard, called **the Hub** (`/dashboard`) |
| **Spokes** | Collections that radiate from the hub | Collections are called **Spokes** internally; a radial spoke map visualizes them |
| **Rim** | The cart and its checkout progress | The Universal Cart and its **progress ring** are the **Rim** |
| **Motion** | A check is running, a URL is parsing | The thin-line spinning **wheel loader** |
| **Balance** | Calm, evenness, no clutter | Generous spacing, hairlines, quiet color |

### Logo

A thin-lined wheel / radial mark. Hairline strokes, no fill weight, no skeuomorphism. It reads as an instrument, not a toy.

### Tone of voice

Calm, premium, confident, human. Short sentences. Plain words. No hype, no exclamation, no "Don't miss out." When UniKart speaks, it is to inform, not to push. Example copy:

- Empty state: _"Nothing saved yet. Paste a link to begin."_
- Price drop: _"Down to $179. The lowest we've tracked."_
- Out of stock: _"Out of stock right now. We'll watch for it to return."_

### Visual system (from `src/app/globals.css` `@theme`)

**Typography**

- `--font-sans`: `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", system-ui, sans-serif`
- `--font-mono`: `"SF Mono", ui-monospace, "JetBrains Mono", "Menlo", monospace`
- Native Apple stack, no web-font fetch. Letter-spacing tightened slightly (`-0.011em`).

**Surfaces** (light only; `color-scheme: light`)

| Token | Hex | Use |
| --- | --- | --- |
| white | `#ffffff` | Cards, solid surfaces |
| porcelain | `#fbfbfd` | Body background |
| canvas | `#f5f5f7` | Secondary fields |
| mist | `#eeeff2` | Inset areas |
| fog | `#e6e8ec` | Deepest inset |

**Metals (text + structure)**

| Token | Hex | Use |
| --- | --- | --- |
| titanium | `#c9cdd4` | Dividers, faint marks |
| silver | `#a1a7b0` | Disabled, tertiary |
| slate | `#6e737c` | Secondary text |
| graphite | `#3a3d42` | Strong secondary |
| ink | `#1d1d1f` | Primary text |
| obsidian | `#0b0b0c` | Deepest contrast |

**Hairlines:** line `rgba(17,19,23,0.08)`, line-strong `rgba(17,19,23,0.14)`.

**Accent (Apple blue, used sparingly):** accent `#0071e3`, accent-strong `#0a84ff`, accent-ink `#0058b0`, accent-soft `#eaf2fe`.

**Semantics**

| Meaning | Token | Hex | Soft | Hex |
| --- | --- | --- | --- | --- |
| Price drop / in stock | down | `#1fa971` | down-soft | `#e6f6ee` |
| Price rise / out of stock | up | `#e5484d` | up-soft | `#fceced` |
| Low stock | warn | `#c77a00` | warn-soft | `#fbf0db` |

**Radii:** sm `.5rem`, md `.75rem`, lg `1rem`, xl `1.25rem`, 2xl `1.75rem`, 3xl `2.25rem`.

**Shadows:** hairline, soft, lift, float — low-contrast and layered. Hairline borders throughout.

**Frosted glass:** `.glass` = blur(20px) saturate(180%) over translucent white; `.glass-strong` = blur(28px) saturate(190%). Used for sticky bars and overlays.

**Motion:** ease `--ease-out-soft` `cubic-bezier(.22,1,.36,1)`. Named animations: `wheel` (spin), `rise`, `fade`, `shimmer`. All motion respects `prefers-reduced-motion`.

**Spoke indicators:** tiny radial marks on cards for price movement, stock, and alert status — small dots/arcs in the down / up / warn / accent colors.

---

## 3. Principles

1. **Calm over loud.** The interface is quiet until a real signal arrives. No urgency theater.
2. **Honest about confidence.** Parsed data carries a confidence level (high / medium / low). UniKart never pretends to know more than it does.
3. **Trust first.** Shopping data is sensitive. Export and deletion are first-class, not buried.
4. **One paste in, one ordered list out.** Saving and checking out are the two flows that must feel effortless.
5. **Deterministic before AI.** Buy Brain ships as transparent, explainable rules. AI replaces the engine later behind the same interface — the verdict is always explainable.
6. **No fake partnerships, no fake processing.** Integrations that don't exist yet are clearly labeled `planned`. No real payment cards are ever stored. No invasive scraping.
7. **Architected to scale down friction now, up capability later.** Mock data and a single mock user in Phase 1; the same shapes map 1:1 to Prisma and real auth later.
8. **Accessible by default.** Keyboard focus is visible, motion is reducible, contrast is sufficient.

---

## 4. Primary user flows

### 4.1 First-run onboarding

**Goal:** From zero to first saved product in under a minute, calmly.

1. **Sign in** (`/sign-in`). Phase 1 uses a mock single-user session behind a simple auth abstraction (structured to drop in Auth.js / NextAuth v5 later). The screen is a single quiet card with the wheel mark.
2. **Welcome to the Hub.** A brief, calm intro: what UniKart is (and is not). One sentence, not a carousel.
3. **The first paste.** The command paste bar is front and center with a single prompt: _"Paste a product link to begin."_
4. **Parse with the wheel loader.** On paste, the thin-line wheel spins while the URL is parsed. _(Phase 1: parsing is simulated from mock data; Phase 3 adds the real parser.)_
5. **Confirm the catch.** The parsed product appears as a card with title, image, price, and a confidence chip. If confidence is low, UniKart invites a quick manual review rather than asserting correctness.
6. **Done.** The Hub now has one product. Empty-state copy is replaced by the grid. The user is gently shown the quick actions (Watch, Add to Cart).

A `/demo` route seeds the Hub with mock products so the experience can be explored without saving anything real.

### 4.2 Hub dashboard (`/dashboard`)

The Hub is home. It has four regions: the **command paste bar**, the **filters**, the **grid**, and (when relevant) calm **empty states**.

#### Command paste bar

- A single, prominent input at the top. Paste a URL; UniKart parses it and adds a product.
- Shows the spinning wheel loader during a parse.
- Accepts a pasted link, a typed/pasted URL, or falls through to **manual entry** if parsing yields nothing usable.
- Tone: an instrument, not a search box. Placeholder: _"Paste a product link…"_

#### Filters

A quiet segmented control. Each filter maps to product/derived state:

| Filter | Shows | Backed by |
| --- | --- | --- |
| **All** | Every non-archived product | default |
| **Watching** | Products with an enabled `AlertRule` | `alert.enabled === true` |
| **Price Drops** | Products where current < previous | `currentPrice < previousPrice` |
| **Back in Stock** | Recently returned to stock | latest `StockSnapshot` transition to `in_stock` |
| **Out of Stock** | Currently unavailable | `availability === "out_of_stock"` |
| **In Cart** | Products in the Universal Cart | `inCart === true` |
| **Purchased** | The archive of bought items | `isPurchased === true` |

Archived-but-not-purchased products are hidden from All and surfaced only via a dedicated archive view in settings/collections.

#### Calm empty states

Every filter has a quiet empty state — a single line and, where useful, one gentle action. No illustrations of frustration, no "Oops."

- **All (first run):** _"Nothing saved yet. Paste a link to begin."_
- **Watching:** _"You're not watching anything yet. Open a product to set a target."_
- **Price Drops:** _"No drops right now. We'll let you know."_
- **In Cart:** _"Your cart is empty. Add something you're ready to consider."_
- **Purchased:** _"Nothing here yet. Completed buys land here."_

#### Product card anatomy

Each card is a calm surface (`.surface` + `.lift` on hover). Top to bottom:

1. **Image** — the product image, or a quiet placeholder if none.
2. **Spoke indicators** — tiny radial marks (top corner) for:
   - **Price movement** — down (green), up (red), or steady.
   - **Stock** — in stock (green), low stock (warn), out of stock (red).
   - **Alert status** — a small accent mark when an alert is enabled.
3. **Title** — one or two lines, balanced.
4. **Store** — `storeName` (from `storeDomain`), quiet slate text.
5. **Price** — `currentPrice` with `currency`. If `previousPrice` differs, a small delta in down/up color. Lowest-ever noted subtly when at/near it.
6. **Confidence chip** — only when `metadataConfidence` is medium or low (high stays silent — confidence is the default).

#### Quick actions

On hover/focus or via an overflow control, each card exposes:

| Action | Effect |
| --- | --- |
| **Watch** | Create/enable an `AlertRule` (defaults to price-drop; target editable in detail). |
| **Add to Cart** | Add a `UniversalCartItem` to the active cart (the Rim). |
| **Move** | Move/assign the product to one or more Collections (Spokes). |
| **Archive** | Set `isArchived = true`; removes it from active filters without deleting history. |
| **Open** | Open the original store page (`originalUrl` / `canonicalUrl`) in a new tab. |

Marking purchased is offered from the product detail and from the checkout flow rather than the card, to keep the card calm.

### 4.3 Collections — "Spokes" (`/collections`)

Collections are the user's groupings — internally **Spokes**, because they radiate from the hub.

- A **radial spoke map** is the signature view: the hub at center, each collection a spoke arm, product counts as small marks along each arm. It is a calm, thin-lined diagram — informative, not decorative.
- A standard list/grid view is always available for those who prefer it.
- Each `Collection` has `name`, an `icon` (a lucide-style glyph token, no emoji), and a `sortOrder`.
- A product can belong to multiple collections (`ProductCollection` join).
- Actions: create, rename, reorder, change icon, delete (deleting a Spoke never deletes the products in it).
- Empty state: _"No spokes yet. Group what you're tracking — by room, by person, by project."_

### 4.4 Product detail (`/products/[id]`)

The full record for one product. Calm, single-column on mobile, two-column on wide screens.

1. **Hero** — large image, title, brand, store, and the current price with movement delta. The Buy Brain verdict sits here as a quiet headline (see §4.10).
2. **Price history chart** — a custom lightweight SVG line chart of `PriceSnapshot` values over time. No heavy dependency. Markers for lowest and highest. (Recharts is an optional future swap.)
3. **Stock history** — a compact timeline of `StockSnapshot` states (in / low / out / preorder / unknown).
4. **Target alert** — set or edit a target price; toggle the alert on/off. When current price meets the target, UniKart says so plainly.
5. **Notes** — a free-text `notes` field for the buyer's own context (size, why, who for).
6. **Confidence level** — `metadataConfidence` shown openly. If low, an invitation to correct parsed fields manually.
7. **Add to cart** — adds the product to the Rim.
8. **Archive / Mark purchased** — archive to hide; mark purchased to move it to the Purchased archive (`isPurchased`, `purchasedAt`).
9. **Open original** — link out to the store.

### 4.5 Price and stock tracking

The engine that makes the Hub more than a list.

- **Snapshots.** Every check appends a `PriceSnapshot` and/or `StockSnapshot` with a `source` of `mock`, `parser`, `manual`, or `scheduled`. History is append-only; this is what powers charts and Buy Brain.
- **Derived fields** on `Product`: `currentPrice`, `previousPrice`, `lowestPrice`, `highestPrice`, `availability`, `lastCheckedAt`.
- **Alert conditions** (`AlertRule.type`):

| Alert type | Fires when |
| --- | --- |
| `price_drop` | Current price falls below the previous |
| `price_rise` | Current price rises above the previous |
| `target_price` | Current price ≤ the user's `targetPrice` |
| `back_in_stock` | Availability returns to `in_stock` |
| `out_of_stock` | Availability becomes `out_of_stock` |

- **Notification center** (`/notifications`). Triggered alerts create `Notification` rows and surface here. See §4.7.
- **Run check now.** A manual action (per product, per collection, or global) that simulates a background check in the MVP: it re-parses / re-mocks current price and stock, writes new snapshots, evaluates alert rules, and creates any notifications. This sits behind a **job abstraction** so a real cron/queue can replace the manual trigger later without changing callers. _(Phase 1: simulated. Real scheduled checks are future work.)_

### 4.6 Universal Cart — "the Rim" — and the Checkout Assistant

The Universal Cart unifies items across stores. Its progress is the **Rim** — a wheel-rim ring.

> **Scope note (MVP):** UniKart does **not** perform one-tap cross-retailer purchasing. It organizes and guides; the buyer completes each checkout themselves.

#### Cart (`/cart`)

- Items (`UniversalCartItem`) are **grouped by merchant** (`storeDomain`).
- Each item shows quantity, latest known price, and latest known stock (`merchantStatus`).
- The cart shows an estimated total per merchant and overall. Estimates are clearly labeled as last-known, not a live charge.

#### Checkout Assistant (`/cart/checkout-assistant`)

A short, ordered process. One merchant at a time.

1. **Verify.** UniKart verifies the latest known price and stock for each item before you go (a Run check now on the cart's contents).
2. **Steps by merchant.** Each merchant becomes a `CheckoutStep` with its items, an `estimatedSubtotal`, and a `checkoutUrl` (product/cart page). Step status follows `CheckoutStepStatus`: `pending → ready → opened → completed` (or `skipped`).
3. **Open in sequence.** The assistant opens each merchant's checkout/product page. The buyer completes the purchase on the merchant's own site.
4. **Mark complete.** The buyer marks each step complete. Completed items move to the **Purchased archive** (`isPurchased = true`, `purchasedAt` set).
5. **Progress ring (the Rim).** A wheel-rim ring fills as steps complete — calm, fitness-ring energy, not a loud progress bar.

#### Integration placeholders

These are **placeholders only** — no real partnerships, no logos, no payment processing. Represented by `IntegrationAdapter` with `status` of `planned` (or `beta`/`live` later). Shown as clearly-labeled future capabilities:

| Adapter (`type`) | Description | Status |
| --- | --- | --- |
| Shopify (`merchant`) | Use a merchant `checkoutUrl` for a smoother hand-off | planned |
| Stripe (`payment`) | Saved payment for supported merchants | planned |
| BNPL partner (`bnpl`) | Buy-now-pay-later, **text only** — no Klarna/Affirm logos, no real partner | planned |
| ACP / agentic commerce (`agentic`) | Agent-assisted checkout | planned |
| Affiliate (`affiliate`) | Optional, clearly disclosed (see §8) | planned |

### 4.7 Notifications (`/notifications`)

The quiet ledger of what changed while you were away.

**Types** (`NotificationType`):

| Type | Meaning |
| --- | --- |
| `price_dropped` | A tracked price fell |
| `target_reached` | Price met your target |
| `back_in_stock` | An item returned to stock |
| `out_of_stock` | An item went out of stock |
| `price_increased` | A tracked price rose |
| `cart_reminder` | A nudge about items waiting in the cart |
| `checkout_incomplete` | A started checkout was left unfinished |

- Each `Notification` has a `title`, `body`, `read` flag, and optional `productId` / `cartId`.
- **Deep links:** product notifications open `/products/[id]`; cart notifications open `/cart` or `/cart/checkout-assistant`.
- Read/unread state, mark-all-read, and per-item dismissal. Calm by design — grouped by day, no badges that scream.
- **Channels:** in-app center in Phase 1. Web push / PWA and email are future work, gated by clear opt-in (see §9 and §7-future).

### 4.8 Browser extension readiness

_Planned. Not in MVP._ The data model and parser are designed so a browser extension can later "Save to UniKart" from any product page.

- The extension would call the same parser/repository layer the paste bar uses (JSON-LD → Open Graph → Twitter card → ecommerce meta → HTML fallback → manual).
- Constraints carry over: no credential capture, no anti-bot bypass, respectful fetches.
- Phase 1 readiness work: keep parsing logic in `src/lib` (not coupled to the page), and keep the repository/data-access layer free of UI assumptions so an extension can reuse it via the future API.

### 4.9 Mobile share-flow readiness

_Planned. Not in MVP._ UniKart ships PWA metadata now so a future install/share target is straightforward.

- The intent: a native (or PWA) **share sheet** target — "Share → UniKart" — that hands a URL to the same parse-and-save path.
- Phase 1 readiness work: PWA metadata in place, a single canonical "save a URL" entry point, and an architecture where eventual native apps talk to the same API.

### 4.10 Buy Brain (Phase 6)

A single, honest verdict: **Buy**, **Wait**, or **Watch** (`BuyVerdict`). It ships **deterministic and explainable**, structured so an AI model can replace the engine later behind the same `BuyBrainResult` interface (`verdict`, `headline`, `reason`, `confidence` 0–1).

Inputs: stock/availability, current price vs. lowest, recent average of the last snapshots, volatility (coefficient of variation), the user's target price, and — for cart context — the cart total.

**The current deterministic rules** (`src/lib/buy-brain.ts`), evaluated in order:

1. **Out of stock or no live price →** `watch` — _"Out of stock right now. We'll watch for it to return."_ / _"No live price yet."_ (confidence 0.6)
2. **At or below target price →** `buy` "Buy now" — _"At or below your target."_ (0.92)
3. **Within 2% of lowest tracked →** `buy` "Buy now" — _"Near the lowest price we've tracked."_ (0.85)
4. **More than 5% below recent average →** `buy` "Good time" — _"Below its recent average — a fair window to buy."_ (0.74)
5. **More than 5% above recent average →** `wait` "Wait" — _"Above its recent average. Prices like this tend to ease."_ (0.7)
6. **Volatility > 0.08 →** `watch` "Watch" — _"Price has been moving. Watch for a dip."_ (0.66)
7. **Otherwise →** `watch` "Watch" — _"Holding steady. No clear signal to rush."_ (0.6)

Recent average uses the last 8 snapshots. The verdict always carries a plain-language reason, never an unexplained score. Buy Brain is a **Pro** capability.

---

## 5. Data models

Defined now in `src/lib/types.ts` (mock data in Phase 1) and mirrored to Prisma in Phase 2 with no shape change. Timestamps are ISO strings.

### Enumerations

- `Availability`: `in_stock | low_stock | out_of_stock | preorder | unknown`
- `MetadataConfidence`: `high | medium | low`
- `AlertType`: `price_drop | price_rise | target_price | back_in_stock | out_of_stock`
- `NotificationType`: `price_dropped | target_reached | back_in_stock | out_of_stock | price_increased | cart_reminder | checkout_incomplete`
- `CartStatus`: `active | checking_out | completed | archived`
- `CheckoutStepStatus`: `pending | ready | opened | completed | skipped`
- `IntegrationType`: `merchant | payment | bnpl | agentic | affiliate`
- `BuyVerdict`: `buy | wait | watch`

### Entities

| Model | Key fields | Notes |
| --- | --- | --- |
| **User** | `id, name, email, image?, plan ("free"\|"pro"), createdAt, updatedAt` | One mock user in Phase 1. |
| **Product** | `id, userId, title, description?, originalUrl, canonicalUrl?, imageUrl?, storeName, storeDomain, brand?, sku?, category?, currency, currentPrice (nullable), previousPrice?, lowestPrice?, highestPrice?, availability, metadataConfidence, notes?, isArchived, isPurchased, purchasedAt?, createdAt, updatedAt, lastCheckedAt?` | The core record. |
| **Collection** | `id, userId, name, icon, sortOrder, createdAt, updatedAt` | A "Spoke." |
| **ProductCollection** | join of `productId` ↔ `collectionId` | Many-to-many. |
| **PriceSnapshot** | `id, productId, price, currency, source ("mock"\|"parser"\|"manual"\|"scheduled"), checkedAt` | Append-only history. |
| **StockSnapshot** | `id, productId, availability, source, checkedAt` | Append-only history. |
| **AlertRule** | `id, productId, userId, type, targetPrice?, enabled, createdAt, updatedAt` | One or more per product. |
| **Notification** | `id, userId, productId?, cartId?, type, title, body, read, createdAt` | Drives the center + deep links. |
| **UniversalCart** | `id, userId, name, status, createdAt, updatedAt` | The Rim. |
| **UniversalCartItem** | `id, cartId, productId, quantity, merchantStatus, checkoutStatus, addedAt, completedAt?` | A line in the cart. |
| **CheckoutStep** | `id, cartId, storeDomain, storeName, status, estimatedSubtotal, currency, checkoutUrl?, itemIds[], openedAt?, completedAt?` | One merchant in the assistant. |
| **IntegrationAdapter** | `id, name, type, enabled, status ("live"\|"planned"\|"beta"), description, configJson, createdAt, updatedAt` | Placeholders, mostly `planned`. |

### Derived view models

- **`ProductView`** extends `Product` with `collections: Collection[]`, `priceHistory: PriceSnapshot[]`, `alert?: AlertRule | null`, and `inCart: boolean`. This is what the UI consumes.

### Storage and access

- **Phase 1:** mock data in `src/lib/mock-data.ts` behind a repository/data-access layer.
- **Phase 2:** Prisma with **SQLite locally** (minimal friction), architected to switch to **Postgres** via provider swap + `DATABASE_URL`. The repository layer abstracts Prisma so callers never import it directly.

---

## 6. Monetization tiers

Monetization-ready, not aggressive. Built so trust is never traded for revenue.

| Tier | Includes |
| --- | --- |
| **Free** | Save products, basic collections (Spokes), manual reminders, manual "Run check now." |
| **Pro** | Automatic tracking, unlimited alerts, advanced price history, **Buy Brain** AI. |
| **Affiliate** | Optional affiliate links, **clearly disclosed**. May earn commission in the future — never hidden. |
| **Partner checkout** | _Future._ Merchant / BNPL / payment hand-offs. No real partnerships today. |

All future-revenue features are labeled as such in the UI and never enabled silently.

---

## 7. Compliance and trust

Shopping data is sensitive. The product is built around trust.

- **Affiliate disclosure-ready** copy in Settings and the footer, with clear _"may earn commission in future"_ language. No active affiliate relationships are claimed.
- **Privacy-first controls** in `/settings`:
  - **Export data** — the user's full record, portable.
  - **Delete account** — complete removal.
  - **Delete product history** — clear snapshots/notifications for a product without deleting it.
- **No real payment processing** in the MVP. **No payment cards are ever stored.**
- **No fake partnerships.** Integration adapters that aren't real are labeled `planned`. No Klarna/Affirm (or any) partner logos; BNPL is text only.
- **No invasive scraping / no anti-bot bypass / no store credentials requested.** Fetches are respectful; mock adapters are used where real pages fail.
- **Auth & identity:** simple mock auth in Phase 1; Auth.js (NextAuth v5) later. Note for the owner: this is a personal project — deploy under the **personal GitHub + Netlify** identity; the machine's global git currently uses a work email, so set a personal git identity for this repo.

**Future notification channels** (web push / PWA / email) require explicit opt-in before anything is sent.

---

## 8. Non-goals and constraints

**Non-goals (MVP):**

- ❌ One-tap cross-retailer purchase. The assistant guides; it does not buy for you.
- ❌ Real payment processing or stored cards.
- ❌ Real merchant / BNPL / affiliate partnerships or logos.
- ❌ Aggressive scraping, anti-bot circumvention, or credential capture.
- ❌ Dark-pattern urgency (countdowns, fake scarcity, loud badges).
- ❌ Multi-user / teams / sharing (single mock user in Phase 1).
- ❌ Native mobile apps and browser extension shipping in MVP (readiness only).

**Hard constraints (locked tech stack):**

- **Next.js 16.2.9** (App Router) — note this version has breaking changes from prior Next.js; consult `node_modules/next/dist/docs/` before writing app code.
- **React 19.2.4**, **TypeScript 5**.
- **Tailwind CSS v4**, CSS-first via `@theme` in `src/app/globals.css`, PostCSS via `@tailwindcss/postcss`. **No `tailwind.config.js`.**
- **framer-motion** (microinteractions), **lucide-react** (thin-line icons), **clsx + tailwind-merge** (`cn` util in `src/lib/utils.ts`).
- **Prisma** Phase 2: SQLite local → Postgres via provider swap; repository layer abstracts it.
- **Custom lightweight SVG** price chart (no heavy charting dep; Recharts optional later).
- **Job abstraction** for future background checks; MVP simulates with manual "Run check now."
- **Deploy target: Netlify** (personal account). PWA metadata present for future mobile. Eventual native apps via the same API.

**Parser order (Phase 3), strict precedence:**

1. JSON-LD `schema.org/Product`
2. Open Graph
3. Twitter card
4. Common ecommerce meta tags
5. HTML `<title>` / image fallback
6. Manual entry fallback

Parser output: `title, description, imageUrl, price, currency, availability, brand, sku, canonicalUrl, storeDomain, confidence, rawMetadata`.

---

## 9. Acceptance criteria

A feature is "done" when the relevant criteria below pass. Phase tags note when a criterion becomes applicable.

### Foundation & brand

- [ ] All colors, radii, shadows, fonts, and animations come from the `@theme` tokens in `globals.css` — no hard-coded hex outside the token definitions.
- [ ] The wheel motif appears as: the spinning thin-line **loader** during parse/check, the **Rim** progress ring on the cart, and the **spoke map** on collections.
- [ ] `prefers-reduced-motion` disables/!important-reduces all animations.
- [ ] Keyboard focus is always visible (`:focus-visible` outline in accent).
- [ ] Tone: no exclamation marks, no urgency/deal-site language anywhere in product copy.

### Onboarding & Hub

- [ ] From `/sign-in`, a mock session lands the user on `/dashboard`.
- [ ] Pasting a valid URL into the command bar shows the wheel loader, then adds a product card.
- [ ] Low/medium `metadataConfidence` shows a confidence chip and offers manual review; high confidence shows no chip.
- [ ] All seven filters (All, Watching, Price Drops, Back in Stock, Out of Stock, In Cart, Purchased) return correctly-scoped results.
- [ ] Each filter has a distinct calm empty state with at most one gentle action.
- [ ] Product cards render image, spoke indicators (price/stock/alert), title, store, and price with delta.
- [ ] Quick actions Watch, Add to Cart, Move, Archive, and Open all work and update derived state.

### Collections (Spokes)

- [ ] The radial spoke map renders the hub + one arm per collection with product counts.
- [ ] A list/grid fallback view exists.
- [ ] Create, rename, reorder, change icon, and delete a Spoke all work; deleting a Spoke never deletes products.
- [ ] A product can belong to multiple Spokes.

### Product detail

- [ ] Hero shows image, title, brand, store, price + movement, and the Buy Brain headline.
- [ ] The SVG price chart renders `priceHistory` with lowest/highest markers and no heavy dependency.
- [ ] Stock history timeline renders `StockSnapshot` states.
- [ ] Setting a target price and toggling the alert persists to an `AlertRule`.
- [ ] Notes save and reload.
- [ ] Add to cart, archive, and mark purchased each update the correct fields (`isArchived`, `isPurchased`, `purchasedAt`).

### Tracking & notifications

- [ ] "Run check now" writes new `PriceSnapshot`/`StockSnapshot` rows via the job abstraction.
- [ ] Each `AlertType` fires its notification under the right condition.
- [ ] The notification center lists notifications, supports read/unread + mark-all-read, and deep-links to the right product or cart page.

### Universal Cart & Checkout Assistant

- [ ] Cart items group by `storeDomain` with per-merchant and overall estimated totals, clearly labeled as last-known.
- [ ] The assistant creates one `CheckoutStep` per merchant and advances status `pending → ready → opened → completed` (or `skipped`).
- [ ] Opening a step links to the merchant page; the app never attempts to purchase automatically.
- [ ] Marking a step complete moves its items to the Purchased archive.
- [ ] The Rim progress ring fills as steps complete and respects reduced motion.
- [ ] Integration adapters render as placeholders with their `status` (mostly `planned`); no real logos, no payment processing, BNPL is text only.

### Buy Brain (Phase 6)

- [ ] `buyBrain()` returns the documented verdict/headline/reason/confidence for each of the seven rule cases.
- [ ] Out-of-stock or null price always yields `watch`; target met always yields `buy`.
- [ ] The reason string is always present and human-readable.
- [ ] Buy Brain is gated to the Pro tier.

### Trust & compliance

- [ ] Settings exposes Export data, Delete account, and Delete product history.
- [ ] Affiliate disclosure copy appears in Settings and the footer with "may earn commission in future" language.
- [ ] No payment card fields exist anywhere; no real payment APIs are called.
- [ ] No code path bypasses anti-bot systems, requests store credentials, or performs aggressive scraping.

### Readiness (no shipped surface required)

- [ ] Parser logic lives in `src/lib` and is reusable by a future extension/API (not coupled to a page).
- [ ] PWA metadata is present for a future mobile/share target.
- [ ] The repository/data-access layer abstracts the data source so Prisma (SQLite → Postgres) and real auth (Auth.js) drop in without changing callers.

---

_End of specification._
