# Future Integrations

> **Status: planned, not shipped.** Everything in this document is a *placeholder*. UniKart has **no current partnerships** with any merchant, payment processor, BNPL provider, affiliate network, or agentic-commerce platform. The MVP **does not process payments** and **does not perform one-tap cross-retailer checkout**. The checkout assistant only groups saved items by merchant, verifies the latest known price and stock, opens each merchant's own checkout or product page in sequence, and lets you mark each step complete. You buy where you always have. UniKart just keeps the sequence calm.

This file describes how UniKart is *architected* to accept these integrations later, so the foundation stays clean. None of it is wired to a live provider today.

---

## The IntegrationAdapter model

UniKart talks to the outside world through one narrow seam: the **IntegrationAdapter**. Every external capability — reading a merchant's catalog, opening a checkout, placing an affiliate link — is expressed as an adapter that conforms to a single shared interface. The rest of the app never imports a vendor SDK directly.

This keeps three promises:

- **Swappable.** A mock adapter and a real adapter are interchangeable. The MVP ships mock adapters everywhere a real provider would otherwise be required.
- **Auditable.** Every outbound capability lives in one place, so trust and compliance review has a single surface to read.
- **Optional.** No adapter is required for the core experience. Saving products, building Spokes, and the manual checkout assistant all work with zero adapters configured.

The `IntegrationAdapter` data model (mirrored in `src/lib/types.ts` now, Prisma in Phase 2) records *which* adapters exist, their kind, their status, and their configuration — never secrets in plain text and never payment data.

```ts
// Conceptual shape. Placeholder — no live provider is wired to this.

export type IntegrationKind =
  | "merchant"   // read catalog / open checkout (e.g. Shopify Storefront)
  | "payment"    // saved payment methods held by a processor (e.g. Stripe)
  | "bnpl"       // generic buy-now-pay-later partner (TEXT ONLY)
  | "agentic"    // ACP-style agentic commerce protocol
  | "affiliate"; // disclosed, optional monetized links

export type IntegrationStatus =
  | "placeholder" // declared, not functional (MVP default for all kinds)
  | "configured"  // credentials/config present, not yet verified
  | "active"      // verified and enabled by the user
  | "disabled";   // turned off; retained for audit

export interface IntegrationAdapter {
  id: string;
  kind: IntegrationKind;
  displayName: string;        // human label shown in Settings
  status: IntegrationStatus;
  storeDomain?: string;       // for merchant adapters, scopes by domain
  capabilities: AdapterCapability[];
  // Configuration is stored as opaque, server-only references.
  // UniKart NEVER stores payment cards or store credentials.
  configRef?: string;         // points to a secret manager entry, not the secret
  disclosure?: string;        // required for affiliate; shown to the user
  createdAt: string;
  updatedAt: string;
}

export type AdapterCapability =
  | "parseProduct"     // read title/price/stock for a product URL
  | "checkLatest"      // refresh latest known price/availability
  | "openCheckout"     // hand off to the merchant's own checkout page
  | "buildAffiliate"   // wrap a destination URL with a disclosed link
  | "describePayment"; // surface non-sensitive payment method metadata
```

### The shared adapter interface

Each kind implements the same minimal contract. The app calls the contract; the adapter hides the vendor detail.

```ts
// Conceptual shape. All concrete adapters are mocks in the MVP.

export interface AdapterContext {
  userId: string;
  // No card data, no store passwords, ever passed through here.
}

export interface ProductRef {
  url: string;
  storeDomain: string;
  sku?: string;
}

export interface LatestSignal {
  currentPrice?: number;
  currency?: string;
  availability?: "in_stock" | "out_of_stock" | "low_stock" | "unknown";
  metadataConfidence: "high" | "medium" | "low";
  checkedAt: string;
}

export interface CheckoutHandoff {
  // UniKart opens this URL; the user completes purchase on the merchant.
  // The MVP never automates this step.
  url: string;
  storeDomain: string;
  note?: string;
}

export interface Adapter {
  readonly kind: IntegrationKind;
  readonly capabilities: AdapterCapability[];

  parseProduct?(ref: ProductRef, ctx: AdapterContext): Promise<LatestSignal>;
  checkLatest?(ref: ProductRef, ctx: AdapterContext): Promise<LatestSignal>;
  openCheckout?(ref: ProductRef, ctx: AdapterContext): Promise<CheckoutHandoff>;
  buildAffiliateUrl?(destination: string, ctx: AdapterContext): Promise<string>;
}
```

**Where it plugs in.** The repository/data-access layer resolves an adapter for a given `storeDomain` or `kind`, falling back to a mock when none is configured. The job abstraction (used by "Run check now") calls `checkLatest`. The checkout assistant calls `openCheckout` to get a handoff URL, then waits for the user to mark the step complete. Nothing in the UI imports a vendor SDK.

---

## Merchant — Shopify Storefront API

**What it enables.** Cleaner, higher-confidence product metadata for stores built on Shopify: title, price, currency, availability, image, and variants read from a structured API instead of scraped HTML. This raises `metadataConfidence` from `medium`/`low` (HTML fallback) toward `high`, and makes "Run check now" more reliable for those stores.

**What is required.**
- A Shopify Storefront API access token, scoped per store and stored only as a server-side `configRef` (never in the client, never in the repo).
- The store's `storeDomain` to scope the adapter.
- Respectful request patterns: rate-limited, cached, no aggressive polling. UniKart does not bypass anti-bot systems and does not scrape aggressively.

**Where it plugs in.** A `merchant` adapter implements `parseProduct` and `checkLatest`. When the parser (Phase 3) encounters a known Shopify domain with a configured adapter, the adapter takes priority over the generic JSON-LD → Open Graph → Twitter → meta → HTML fallback chain. Without a token, the generic parser runs as usual. The MVP ships a **mock Shopify adapter** that returns deterministic sample data so the flow is testable end to end.

> Placeholder. No Shopify partnership, app listing, or live token exists today.

---

## Payment — Stripe saved payment methods

**What it enables.** A future, opt-in convenience where a returning user's *non-sensitive* payment metadata (for example, "Visa ending 4242") can be surfaced to speed up a self-directed checkout. This is descriptive only — it never completes a purchase inside UniKart.

**What is required.**
- A Stripe account and server-side secret, stored as a `configRef` in a secret manager, never in the client and never in the repo.
- Stripe-hosted elements or Stripe's own UI for any card entry, so card data goes directly to Stripe.
- A clear, explicit user opt-in with the ability to disconnect at any time.

**The hard rule: UniKart never stores cards.** No PAN, no CVV, no full card number ever touches UniKart's database, logs, or memory. UniKart stores only an opaque Stripe reference and, at most, the brand and last four digits that Stripe returns for display. The `payment` adapter exposes only `describePayment` — non-sensitive metadata. There is no capability to charge a card from within UniKart in this design.

**Where it plugs in.** The checkout assistant may *display* a saved-method hint next to a merchant step, purely as a reminder, while the actual payment happens on the merchant's own page. The MVP ships a **mock payment adapter** that returns placeholder display text only.

> Placeholder. No Stripe account is connected and no payments are processed in the MVP.

---

## BNPL — generic partner placeholder (text only)

**What it enables.** A future, text-only mention that a "buy now, pay later" option *may* exist at a given merchant, so a user can factor it into a Buy / Wait / Watch decision. This is informational copy, nothing more.

**What is required.**
- A real, disclosed agreement with a BNPL provider before any such feature ships. None exists today.
- Plain-language copy that makes clear UniKart neither offers nor underwrites financing.

**Hard constraints.**
- **Text only.** No logos, no brand marks, no checkout buttons.
- **No named-brand endorsements.** Do **not** use Klarna, Affirm, or any specific provider's name or logo as an endorsement. The placeholder is a generic "BNPL partner" string until a real, disclosed partnership is in place.
- **No financing offered by UniKart.** UniKart does not lend, underwrite, or process installment plans.

**Where it plugs in.** A `bnpl` adapter, if ever configured, would contribute a neutral text note to a product or checkout step. The MVP ships a **mock BNPL adapter** that returns only generic placeholder text.

> Placeholder. No BNPL partnership exists. Generic wording only.

---

## Agentic commerce — ACP-style protocol

**What it enables.** A forward-looking path where an agent could, with explicit user authorization, negotiate a structured checkout with a merchant that supports an Agentic Commerce Protocol (ACP)-style standard — discovering items, confirming price and stock, and handing back a structured result.

**What is required.**
- A published, interoperable ACP-style standard and a merchant that supports it. This is emerging and not assumed.
- Explicit, per-action user authorization. UniKart does not act autonomously on a user's money.
- A clear audit trail of every agent action, surfaced to the user.

**Where it plugs in.** An `agentic` adapter would implement the contract behind a strict authorization gate, reusing the same `openCheckout`/handoff seam rather than introducing a separate purchase path. The MVP ships a **mock agentic adapter** that simulates a structured handoff without contacting any real endpoint.

> Placeholder. No agentic checkout, no autonomous purchasing, no live protocol endpoint in the MVP.

---

## Affiliate — optional, disclosed monetized links

**What it enables.** An optional way for UniKart to earn a commission in the future when a user buys through a link UniKart provided — supporting the project without changing the price the user pays.

**What is required.**
- Membership in an affiliate program before any link is monetized. None is active today.
- A stored, user-visible `disclosure` string on the adapter.
- Disclosure surfaced in **two** places at minimum: the footer and Settings, with clear "we may earn a commission in future" language. Affiliate links must be visibly labeled at the point of use.

**Trust posture.**
- Affiliate status must **never** influence Buy / Wait / Watch guidance from Buy Brain. Recommendations are deterministic and based on stock, current vs. lowest, recent average, volatility, target price, and cart total — not on commission.
- Affiliate links are opt-in and clearly disclosed, never hidden redirects.

**Where it plugs in.** An `affiliate` adapter implements `buildAffiliateUrl`, wrapping a destination URL with a tracked, disclosed link only when enabled. The MVP ships a **mock affiliate adapter** that returns the destination URL unchanged and carries placeholder disclosure copy.

> Placeholder. No affiliate program is joined and no links are monetized in the MVP.

---

## Phased rollout

| Phase | Integration | MVP state | What "real" requires | Plugs into |
|------|-------------|-----------|----------------------|------------|
| 1 | IntegrationAdapter model + shared interface | Defined; mocks only | — | Repository / data-access layer |
| 3 | Merchant (Shopify Storefront API) | Mock adapter | Storefront token, store domain, respectful rate limits | Product parser, `checkLatest` job |
| 5 | Checkout assistant handoff seam | Manual, sequential, user-marked | Nothing more required for MVP | `openCheckout` → handoff URL |
| Future | Payment (Stripe saved methods) | Mock; display text only | Stripe account, opt-in, hosted elements | Display hint in checkout assistant |
| Future | BNPL (generic partner) | Mock; text only | A real, disclosed BNPL agreement | Neutral text note on product / step |
| Future | Agentic commerce (ACP-style) | Mock; simulated handoff | Published standard, supporting merchant, per-action auth | Authorized `openCheckout` path |
| Future | Affiliate (disclosed links) | Mock; passthrough URL | Affiliate program membership, live disclosure | `buildAffiliateUrl` |

---

## Compliance & trust checklist

Every integration must pass all of these before it moves from `placeholder` to `active`:

- [ ] **No payment data stored.** No card number, CVV, or full PAN in UniKart's database, logs, or memory — ever.
- [ ] **No store credentials requested.** UniKart never asks for a user's merchant account password.
- [ ] **No anti-bot bypass.** No defeating CAPTCHAs or bot defenses; respectful, rate-limited, cached fetches only.
- [ ] **No aggressive scraping.** Structured APIs are preferred; HTML fallback is gentle and cached.
- [ ] **No fake partnerships.** No partner named, logo shown, or relationship implied until a real, signed agreement exists.
- [ ] **No named BNPL endorsements.** No Klarna, Affirm, or other provider names or logos used as endorsements; generic text only.
- [ ] **Secrets server-side only.** Credentials live behind a `configRef` in a secret manager, never in the client or the repo.
- [ ] **Explicit opt-in.** Payment, BNPL, agentic, and affiliate features are off by default and user-enabled.
- [ ] **Per-action authorization.** No autonomous spending; agentic actions require explicit per-action consent and an audit trail.
- [ ] **Affiliate disclosed.** Clear "may earn a commission in future" language in the footer and Settings, with links labeled at the point of use.
- [ ] **Recommendations stay neutral.** Buy Brain guidance is never influenced by affiliate or partner incentives.
- [ ] **Privacy-first.** Shopping data is sensitive; users can export data, delete their account, and delete product history.
- [ ] **Reversible.** Every integration can be disconnected, and disconnecting stops all related data flow.

---

## Disclaimer

> **All integrations described in this document are placeholders.**
>
> UniKart has **no current partnerships** with any merchant, payment processor, buy-now-pay-later provider, affiliate network, or agentic-commerce platform.
>
> The MVP **does not process payments**, **does not store payment cards**, **does not request store credentials**, and **does not perform one-tap or cross-retailer purchasing**. The checkout assistant only groups saved items by merchant, verifies the latest known price and stock, opens each merchant's own page in sequence, and lets the user mark each step complete.
>
> Provider names mentioned here (such as Shopify or Stripe) describe the *kind* of API a future adapter could target. Their inclusion is not an endorsement, partnership, or claim of integration. Named buy-now-pay-later brands are deliberately **not** used. Nothing here represents a shipped feature.
