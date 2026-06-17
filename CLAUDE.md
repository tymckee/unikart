@AGENTS.md

# Brand & product identity

UniKart's brand and product identity is the **source of truth** for every feature, copy change, visual, and deploy. The full guide is imported here so it's always in context:

@docs/BRAND.md

## Non-negotiables (always honor — restated inline)

- **Name:** "UniKart" only — never Unicart, UniCart, Uni Kart, or Uni-Kart. The domain `uni-kart.com` is the sole exception.
- **Voice:** calm, plain, unhurried. No urgency or pressure, **no exclamation marks**, no hype/clickbait, and **no dark patterns** (no fake scarcity, countdowns, guilt, pre-checked upsells, or manipulative cancellation).
- **Signal:** the buy recommendation is **"Signal"** (never "Buy Brain"), is **gated by confidence**, and is framed as **"based on tracked price history" — never financial advice**.
- **Guided checkout:** purchase payment **always stays on the merchant's own site**; UniKart never takes payment for a purchase. (The only thing we bill is the UniKart Pro subscription via Stripe.)
- **One source of truth for all totals** — never show conflicting prices/totals/savings across views.
- **Privacy controls stay free** — privacy, data export, and account deletion are never paywalled.
- **Wheel motif stays subtle** — an abstract, thin-lined hub/spokes/rim mark; **never a literal bicycle**.
- **Honesty:** never fabricate a price, spec, or stock status; show uncertainty (confidence) rather than inventing data.
- **Lexicon:** Collections (not "Spokes" in UI), Release, the gist, Universal Cart, Hub, UniKart Pro.

## Definition of Done — brand checklist (deploy gate)

Treat the **"Definition of Done — brand checklist"** in `docs/BRAND.md` (§8) as a **required gate before every deploy** and in every PR/commit. Run through all 11 items; if any fails, fix it or explicitly flag the exception before shipping.

## Working rule

Before writing any user-facing string, UI, or shipping a change, **check the work against `docs/BRAND.md` and call out any conflict** instead of silently overriding it.
