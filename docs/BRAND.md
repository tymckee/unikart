# UniKart — Brand & Product Identity

> The source of truth for every feature, copy change, visual, and deploy.
> If a change conflicts with this document, surface the conflict — don't silently override it.

---

## 1. Essence

UniKart is **a calm buying operating system**. Paste anything you're considering → save it → organize it → track price and stock → buy when it feels right. The feeling is **premium, unhurried, and quiet** — the opposite of the noisy, urgent, manipulative web of shopping.

**Promise:** *Shopping without the noise.*

**We are:** calm, considered, honest, on your side.
**We are not:** loud, pushy, gamified, salesy, cluttered.

---

## 2. Name & spelling — NON-NEGOTIABLE

- The product is **UniKart** — always this exact casing (capital U, capital K).
- **Never** write Unicart, UniCart, Uni Kart, or Uni-Kart.
- The **only** exception is the domain **uni-kart.com** (and email addresses on it).

---

## 3. Voice & tone

Calm, plain-spoken, confident, and spare. We sound like a trusted friend who's done the research, not a marketer.

**Do**
- Short, plain sentences. Let whitespace and the product do the talking.
- Reassure and inform. "Price is holding steady. No reason to rush."
- Be honest about uncertainty ("low confidence", "couldn't read this page").
- Sentence case for almost everything.

**Don't — NON-NEGOTIABLE**
- **No urgency or pressure** — no countdowns, fake scarcity ("only 2 left!"), "act now", or guilt.
- **No exclamation marks** in product copy.
- **No hype / clickbait** — no "amazing", "best ever", "must-have", "🔥".
- **No dark patterns** — no pre-checked upsells, confusing cancellation, manipulative defaults, or shaming opt-outs ("No thanks, I hate saving money").

**Voice examples**
- ✅ "Saved. We'll watch the price and let you know when it moves."  ❌ "Saved!! 🎉 Don't miss out!"
- ✅ "Considering for 12 days."  ❌ "You've been missing out for 12 days!"
- ✅ "Released — you let it go."  ❌ "Are you SURE you want to delete this?!"
- ✅ "Card required; cancel anytime; renews automatically at $5/month after your trial."  ❌ "Start saving now before this deal expires!"

---

## 4. Product lexicon

Use these exact terms in the UI. (Internal code names may differ; user-facing copy must not.)

| Concept | Use | Never |
|---|---|---|
| The buy recommendation | **Signal** (gated by confidence) | "Buy Brain" |
| Groups of saved items | **Collections** | "Spokes" (UI) — keep only in code/metaphor |
| Letting go of an item | **Release** ("let it go") | "delete" framing as the primary verb |
| AI summary of a product | **the gist** | "AI analysis", "summary bot" |
| The cross-store cart | **Universal Cart** | "checkout cart" |
| Guided buying help | **Checkout Assistant** (guided) | "auto-buy", "1-click buy" |
| Your saved-items home | **Hub** | "dashboard" (in copy) |
| How long something's waited | **"Considering for X"** | "waiting", "abandoned" |
| Paid tier | **UniKart Pro** | "Premium", "Plus" |

**Signal — NON-NEGOTIABLE:** it is guidance, **always gated by confidence**, and framed as **"Based on tracked price history"** — *never* financial advice, never a guarantee, never "you should buy this."

---

## 5. Commerce principles — NON-NEGOTIABLE

- **Guided checkout, payment stays on the merchant.** UniKart never takes payment for a *purchase*. We guide you to buy on the store's own site. (The only thing UniKart charges for is the **UniKart Pro** subscription, via Stripe.)
- **One source of truth for all totals.** Prices, cart totals, and savings must be computed once and shown consistently — never conflicting numbers across views.
- **Honest data, always.** Never fabricate a price, spec, or stock status. When we don't know, say so (confidence levels). A blank price beats a made-up one.
- **We never ask for store logins.** No scraping wishlists via the user's retailer credentials.
- **Privacy controls stay free.** Privacy, data export, and account deletion are never paywalled or degraded for free users.

---

## 6. Visual identity

**Palette** (CSS variables in `src/app/globals.css`):
- Surfaces: **porcelain / canvas** (near-white, faintly warm/cool).
- Lines: **titanium / silver / fog** — hairline borders (1px), never heavy.
- Text: **ink** (near-black) primary, **slate** secondary, **silver** tertiary.
- Accent: a single calm **blue**, used *sparingly* (one highlight at a time).
- State: price **down = quiet green**, **up = muted**, never alarming red/green dashboards.

**Form**
- Glass panels (`GlassCard`), generous whitespace, `rounded-2xl`, soft diffuse shadows.
- Typography: the system SF stack, tight tracking on headings, `tabular-nums` for prices.
- Restraint over decoration. Empty states are calm, not salesy.

**The wheel motif — NON-NEGOTIABLE:** UniKart's mark is an abstract **thin-lined bike wheel** (hub, spokes, rim). Keep it **subtle and geometric**. **Never a literal bicycle**, never cartoonish, never spinning gimmicks.

**Motion:** gentle and purposeful (soft fades/slides, easing `[0.22,1,0.36,1]`). Nothing bouncy or attention-grabbing. Always honor `prefers-reduced-motion`.

---

## 7. Accessibility

- Sufficient contrast for ink/slate on porcelain; never rely on color alone (pair with text/icons).
- Keyboard-navigable; meaningful `aria-label`s; `role="img"` + descriptive labels on SVGs.
- Respect reduced-motion and reduced-transparency.

---

## 8. Definition of Done — brand checklist

**Gate before every deploy and every user-facing change.** All must be true:

1. **Spelling:** "UniKart" everywhere (domain `uni-kart.com` the only exception).
2. **Voice:** calm; no urgency, no exclamation marks, no hype, no dark patterns.
3. **Signal:** any buy guidance is called "Signal," confidence-gated, and framed as "based on tracked price history" — not financial advice.
4. **Lexicon:** Collections (not Spokes), Release, the gist, Universal Cart, Hub, UniKart Pro used correctly.
5. **Checkout:** purchase payment stays on the merchant's site; only UniKart Pro is billed by us.
6. **Totals:** one source of truth; no conflicting numbers.
7. **Honesty:** no fabricated prices/specs/stock; uncertainty shown, not hidden.
8. **Privacy:** privacy/export/delete controls remain free and accessible.
9. **Visual:** porcelain/titanium/ink palette, hairline borders, calm spacing; accent used sparingly.
10. **Wheel motif:** subtle/abstract; no literal bicycle.
11. **Motion & a11y:** gentle motion, `prefers-reduced-motion` honored, contrast + labels adequate.

If any item fails, fix it or explicitly flag the exception before shipping.
