# UniKart Design System

UniKart is a calm buying operating system. Save what you want, understand when to buy, and check out with less chaos. This document is the single reference for how UniKart looks, moves, and speaks.

The system is Apple-inspired: porcelain surfaces, hairline borders, soft layered shadows, native system type, and accent used sparingly. It is not a wishlist app and not a deal site. Everything here should feel quiet, premium, and trustworthy.

> Tokens live in code. All design tokens are defined in Tailwind v4 CSS-first style inside the `@theme` block of `src/app/globals.css`. There is no `tailwind.config.js`. This document mirrors those tokens; the CSS file is the source of truth.

---

## 1. Design principles

- **Calm over loud.** No ecommerce hype, no countdown timers, no red urgency. Restraint is the brand.
- **Premium by restraint.** Whitespace, hairlines, and soft shadows carry the polish. We add weight by removing clutter, not by adding decoration.
- **Confident and human.** Clear language, honest signals, no dark patterns. Shopping data is sensitive; the design earns trust.
- **Signal, not noise.** Surface the one thing that matters now (buy, wait, watch) and let everything else recede.
- **One accent, used sparingly.** Apple blue marks the single most important action on a surface. If two things are blue, one of them is wrong.
- **Motion with meaning.** Animation explains state and rewards intent. It never performs for its own sake.
- **Accessible by default.** Keyboard-first, reduced-motion aware, readable contrast. These are requirements, not enhancements.

---

## 2. The wheel motif, used sparingly

UniKart's identity is a quiet bike-wheel metaphor: **hub, spokes, rim, motion, balance.** A thin-lined wheel or radial mark. Never a cartoon bike, never childish.

The vocabulary maps to the product:

- **Hub** — the dashboard (`/dashboard`), the calm center where everything is held.
- **Spokes** — collections. Internally and in code, collections are "Spokes."
- **Rim** — the cart progress ring on the checkout assistant.
- **Motion / balance** — the feeling of the whole system: smooth, weighted, settled.

How to use it well:

- One wheel reference per view, at most. The motif is seasoning, not the meal.
- Render it as thin line work, consistent with `lucide-react` stroke weight.
- Let it carry meaning (progress, grouping, state) rather than appear as ornament.
- Never use a literal bicycle illustration. Never animate it as a gimmick.

When in doubt, leave the wheel out. The metaphor is strongest when it is felt, not pointed at.

---

## 3. Color tokens

All values below are exact and match `@theme` in `src/app/globals.css`. Use token names (e.g. `bg-porcelain`, `text-ink`, `text-slate`) rather than raw hex in components.

### Surfaces

| Token | Value | Usage |
| --- | --- | --- |
| `white` | `#ffffff` | Solid cards, raised surfaces, sheet backgrounds |
| `porcelain` | `#fbfbfd` | Default body background |
| `canvas` | `#f5f5f7` | Recessed sections, grouped backgrounds |
| `mist` | `#eeeff2` | Subtle fills, inactive chips, track backgrounds |
| `fog` | `#e6e8ec` | Deeper fills, dividers between large blocks |

### Metals (text and structure)

| Token | Value | Usage |
| --- | --- | --- |
| `titanium` | `#c9cdd4` | Disabled borders, faint marks, scrollbar thumb |
| `silver` | `#a1a7b0` | Tertiary text, placeholder, muted icons |
| `slate` | `#6e737c` | Secondary text, captions, helper copy |
| `graphite` | `#3a3d42` | Strong secondary text, active icons |
| `ink` | `#1d1d1f` | Primary text, headings |
| `obsidian` | `#0b0b0c` | Maximum-contrast text, rare emphasis |

### Hairlines

| Token | Value | Usage |
| --- | --- | --- |
| `line` | `rgba(17, 19, 23, 0.08)` | Default hairline borders and dividers |
| `line-strong` | `rgba(17, 19, 23, 0.14)` | Hover/active borders, stronger separation |

### Accent (Apple blue — used sparingly)

| Token | Value | Usage |
| --- | --- | --- |
| `accent` | `#0071e3` | Primary action, focus ring, single key CTA per surface |
| `accent-strong` | `#0a84ff` | Active/pressed accent, brighter emphasis |
| `accent-ink` | `#0058b0` | Accent text on light fills, accessible link color |
| `accent-soft` | `#eaf2fe` | Accent backgrounds, selected states, soft highlights |

### Semantics

| Token | Value | Usage |
| --- | --- | --- |
| `down` | `#1fa971` | Price drop (good), in stock |
| `down-soft` | `#e6f6ee` | Background for price-drop / in-stock states |
| `up` | `#e5484d` | Price rise, out of stock |
| `up-soft` | `#fceced` | Background for price-rise / out-of-stock states |
| `warn` | `#c77a00` | Low stock |
| `warn-soft` | `#fbf0db` | Background for low-stock states |

> Note on semantics: green means a *drop* (favorable for the buyer), not "success" in the generic sense. Red means a *rise* or stockout. Keep this mapping consistent everywhere price and stock are shown.

---

## 4. Typography

UniKart uses the native Apple system stack. No web fonts are fetched, so type renders instantly and feels native on Apple hardware.

### Font stacks

```css
--font-sans: -apple-system, BlinkMacSystemFont, "SF Pro Display",
  "SF Pro Text", "Inter", system-ui, sans-serif;
--font-mono: "SF Mono", ui-monospace, "JetBrains Mono", "Menlo", monospace;
```

- **Sans** — all UI and content.
- **Mono** — prices, SKUs, currency, raw metadata, and code-like values where alignment helps.

### Rendering defaults (set on `body`)

- Letter-spacing (tracking): **`-0.011em`** applied globally for a tight, Apple-like set.
- Font smoothing: `-webkit-font-smoothing: antialiased`, `-moz-osx-font-smoothing: grayscale`.
- Feature settings: `"ss01", "cv01", "cv11"`.
- `text-rendering: optimizeLegibility`.

### Weights

Lean on a small, deliberate range. The system stack maps these to SF cleanly.

| Weight | Token | Usage |
| --- | --- | --- |
| 400 Regular | `font-normal` | Body text, descriptions |
| 500 Medium | `font-medium` | UI labels, secondary headings, buttons |
| 600 Semibold | `font-semibold` | Card titles, section headers, emphasis |
| 700 Bold | `font-bold` | Display and hero headlines only |

Avoid heavier weights. Premium feel comes from tracking and spacing, not from boldness.

### Scale

A calm, modular scale. Headings use tighter tracking; small UI text can sit at the default.

| Role | Size | Line height | Tracking | Weight |
| --- | --- | --- | --- | --- |
| Display | 3rem / 48px | 1.05 | -0.022em | 600–700 |
| H1 | 2.25rem / 36px | 1.1 | -0.02em | 600 |
| H2 | 1.5rem / 24px | 1.2 | -0.018em | 600 |
| H3 | 1.25rem / 20px | 1.3 | -0.014em | 600 |
| Body large | 1.125rem / 18px | 1.5 | -0.011em | 400 |
| Body | 1rem / 16px | 1.5 | -0.011em | 400 |
| Caption | 0.875rem / 14px | 1.45 | -0.006em | 400–500 |
| Micro | 0.75rem / 12px | 1.4 | 0 | 500 |

Use `text-balance` on headlines and `text-pretty` on paragraphs (both available as utilities) to keep wrapping graceful.

---

## 5. Radii

Generous, Apple-soft corners. Match radius to component scale: small controls get small radii, large surfaces get large radii.

| Token | Value | Usage |
| --- | --- | --- |
| `rounded-sm` | `0.5rem` | Inputs, small chips, tight controls |
| `rounded-md` | `0.75rem` | Buttons, badges, list rows |
| `rounded-lg` | `1rem` | Cards, panels |
| `rounded-xl` | `1.25rem` | Larger cards, product tiles |
| `rounded-2xl` | `1.75rem` | Sheets, feature panels, hero surfaces |
| `rounded-3xl` | `2.25rem` | Full-bleed modals, marketing blocks |

Keep radii consistent within a component group. Never mix sharp and soft corners on the same surface.

---

## 6. Elevation, shadow, and hairline borders

Elevation is communicated by **soft, layered, low-contrast shadows** combined with **hairline borders**. Surfaces almost always carry a `line` border in addition to any shadow — the hairline does the structural work, the shadow adds depth.

| Token | Value | Usage |
| --- | --- | --- |
| `shadow-hairline` | `0 0 0 1px rgba(17, 19, 23, 0.06)` | Crisp single-pixel ring, flush elements |
| `shadow-soft` | `0 1px 2px rgba(17,19,23,0.04), 0 8px 24px -12px rgba(17,19,23,0.12)` | Resting cards and panels (`.surface`, `.glass`) |
| `shadow-lift` | `0 1px 2px rgba(17,19,23,0.05), 0 18px 48px -18px rgba(17,19,23,0.22)` | Hovered cards, raised sheets (`.lift:hover`, `.glass-strong`) |
| `shadow-float` | `0 2px 6px rgba(17,19,23,0.06), 0 30px 70px -24px rgba(17,19,23,0.28)` | Floating overlays, popovers, modals |

Hairline borders:

- `line` is the default border everywhere. The base layer sets `border-color: var(--color-line)` on all elements, so most components only need a border *style*, not a color.
- `line-strong` appears on hover and active states for a touch more definition.
- The `.hairline` component class applies the default divider color directly.

Elevation ladder: flat content on `porcelain` → `shadow-hairline` for flush chips → `shadow-soft` resting cards → `shadow-lift` on hover or raised sheets → `shadow-float` for true overlays. Move one step at a time.

---

## 7. Glass and blur

Frosted glass is reserved for layers that float over content: top bars, sticky headers, the checkout assistant rim panel, and modal chromes. Two ready classes exist.

| Class | Background | Blur / saturate | Shadow | Usage |
| --- | --- | --- | --- | --- |
| `.glass` | white at 72% | `blur(20px) saturate(180%)` | `shadow-soft` | Standard frosted panels, sticky headers |
| `.glass-strong` | white at 86% | `blur(28px) saturate(190%)` | `shadow-lift` | Prominent overlays, raised sheets, modals |

Both include `-webkit-backdrop-filter` for Safari and a `line` hairline border.

Guidance:

- Use glass only when there is meaningful content behind it to soften. Over a flat background it just looks foggy.
- Keep text on glass at `ink` or `graphite` for legibility; do not place fine `silver` text on glass.
- One glass layer at a time. Stacking blurred surfaces muddies the view and costs performance.

For solid raised surfaces with no translucency, use `.surface` (white, hairline border, `shadow-soft`) instead.

---

## 8. Motion

Motion is calm and purposeful. It explains state changes and rewards intent, then gets out of the way.

### Eases

| Token | Value | Usage |
| --- | --- | --- |
| `--ease-out-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` | Default for entrances, hovers, most transitions |
| `--ease-in-out-soft` | `cubic-bezier(0.65, 0, 0.35, 1)` | Symmetric moves, toggles, reversible transitions |

### Durations

- **Micro** (120–200ms) — hover, press, focus, small state flips.
- **Standard** (300–400ms) — card lift, panel reveals, fades. The `.lift` class transitions transform, shadow, and border over `0.4s`.
- **Deliberate** (500ms) — content rising into view (`rise`), larger sheet entrances.

Keep durations short. If a motion feels slow, it is slow.

### Animations (defined in `@theme`)

| Token | Definition | Usage |
| --- | --- | --- |
| `--animate-wheel` | `wheel 1.1s linear infinite` | The product-parse loader; spinning thin-line wheel |
| `--animate-wheel-slow` | `wheel 9s linear infinite` | Ambient, near-still wheel accents |
| `--animate-rise` | `rise 0.5s var(--ease-out-soft) both` | Content entering: fade up 8px into place |
| `--animate-fade` | `fade 0.4s var(--ease-out-soft) both` | Simple opacity entrance |
| `--animate-shimmer` | `shimmer 1.6s ease-in-out infinite` | Skeleton loading placeholders |

`framer-motion` handles richer microinteractions (drag, layout, staged lists). Keep its springs gentle and its distances small, consistent with the eases above.

### prefers-reduced-motion

The system honors reduced motion globally. When `prefers-reduced-motion: reduce` is set, all animations and transitions collapse to ~`0.001ms`, iteration counts drop to 1, and `scroll-behavior` becomes `auto`. Build features so they are fully usable with motion effectively off — never gate meaning behind an animation.

---

## 9. Iconography

- Library: **`lucide-react`** thin-line icons. They sit naturally beside the system type.
- Stroke width: **1.5** everywhere. This is the house weight; do not mix stroke widths in a single view.
- Default size: 20px in dense UI, 24px for primary actions. Match optical size to nearby text.
- Color: inherit `currentColor`. Icons take `slate`/`graphite` in rest, `accent` only when marking the single key action, and semantic colors (`down`, `up`, `warn`) for price/stock signals.
- Keep icons functional. Avoid decorative icon clusters; one clear glyph beats three.
- Provide an accessible label (`aria-label`) for icon-only controls.

---

## 10. Spoke indicators and the wheel loader

### Spoke indicators

Cards carry tiny **radial marks** — "spokes" — that report status at a glance, echoing the wheel motif at small scale. They are minimal: a short tick, dot, or arc, never a full chart.

| Indicator | Signal | Color |
| --- | --- | --- |
| Price movement | Drop / rise since last check | `down` / `up` |
| Stock | In stock / low / out | `down` / `warn` / `up` |
| Alert status | An active `AlertRule` is watching | `accent` |

Rules:

- Keep marks tiny and quiet; they read as texture until you look closely.
- Use the semantic palette so meaning is consistent with everything else.
- Never let spoke indicators crowd the title or price. They sit in a corner or along an edge.

### The wheel loader

While a product URL is being parsed, show a **spinning thin-line wheel** using `--animate-wheel` (`1.1s linear infinite`). It is the literal hub-and-spokes mark in motion — the one place the wheel spins with purpose.

- Pair it with calm copy: "Reading the page…" rather than a percentage.
- Honor reduced motion: the wheel resolves to a static mark, and a text status communicates progress.
- Reuse `shimmer` skeletons for surrounding placeholder content while parsing.

---

## 11. Component inventory

A working catalog of UniKart components. Items marked **(planned)** are designed but not yet shipped — do not present them as live.

**Foundations**
- `cn` class-merge util (`clsx` + `tailwind-merge`) in `src/lib/utils.ts`
- Surface (`.surface`), Glass (`.glass`, `.glass-strong`), Lift (`.lift`), Hairline (`.hairline`)

**Layout and navigation**
- App shell / top bar (glass, sticky)
- Hub dashboard layout (`/dashboard`)
- Sidebar / section nav
- Footer (with affiliate disclosure copy)

**Inputs and controls**
- Button (primary accent, secondary, quiet/ghost)
- Text input, URL paste field
- Select / segmented control
- Toggle / switch
- Search field with `Cmd/Ctrl+K` paste affordance

**Data display**
- Product card (with spoke indicators)
- Product detail view (`/products/[id]`)
- Price chart — custom lightweight SVG, no heavy dependency
- Collection ("Spoke") card and grid (`/collections`)
- Stat / KPI tiles for the Hub
- Empty states and skeletons (`shimmer`)

**Cart and checkout**
- Universal cart list grouped by merchant (`/cart`)
- Rim progress ring — wheel-rim cart progress
- Checkout assistant step list (`/cart/checkout-assistant`); user marks each step complete
- Purchased archive view

**Signals and feedback**
- Spoke indicators (price / stock / alert)
- Buy / Wait / Watch verdict badge (Buy Brain, **planned**)
- Notification list (`/notifications`)
- Toast / inline status
- Wheel loader (URL parsing)

**System**
- Auth: sign-in (`/sign-in`), mock single-user session in Phase 1
- Settings (`/settings`) — privacy controls, affiliate disclosure, data export/delete
- Demo (`/demo`)

---

## 12. Voice and tone

UniKart speaks calm, premium, confident, and human. We help people make good decisions without pressure. No hype, no fake scarcity, no shouting.

**Do**
- Be plain and reassuring. Short sentences. One idea at a time.
- Name the decision, not the deal: "Now's a good time" beats "DON'T MISS OUT."
- Be honest about confidence and about what's known vs. estimated.
- Use the brand vocabulary naturally (Hub, Spokes, Rim) without over-explaining it.

**Don't**
- No urgency theatrics, exclamation pile-ups, or "lowest price EVER!!!"
- No guilt or manipulation. No dark patterns.
- No invented partnerships or promises. Future features are labeled as future.

### Example microcopy

- **Save a product:** "Saved. We'll keep an eye on it."
- **Price drop:** "Down $40 since you saved it. Lowest we've seen."
- **Price rise:** "Up a little this week. No rush."
- **Out of stock:** "Out of stock right now. We'll tell you when it's back."
- **Buy Brain verdict (planned):** "Buy — at its lowest, and in stock." / "Wait — prices usually dip soon." / "Watch — not enough history yet."
- **Empty cart:** "Nothing in the cart yet. Add something you're considering."
- **Checkout assistant:** "Three merchants, four items. We'll take them one at a time."
- **Run a check:** "Run check now" → "Checked just now. Nothing changed."
- **Affiliate disclosure:** "We may earn a commission on some links in the future. We'll always say when we do."
- **Privacy:** "Your shopping data is yours. Export it or delete it anytime."

---

## 13. Accessibility

Accessibility is a baseline requirement.

### Focus

- `:focus-visible` shows a clear ring: `2px solid var(--color-accent)`, `outline-offset: 2px`, `border-radius: 4px`. It is quiet for mouse users and unmistakable for keyboard users.
- Never remove focus outlines. If a custom control needs a different ring, it must be at least as visible as the default.
- Maintain a logical tab order; every interactive element is reachable and operable by keyboard.

### Contrast

- Body and headings use `ink` (`#1d1d1f`) on `porcelain`/`white` — high contrast.
- Secondary text uses `slate` (`#6e737c`); reserve lighter metals (`silver`, `titanium`) for non-essential text and decoration, not for content that must be read.
- Links and accent text on light surfaces use `accent-ink` (`#0058b0`) for stronger contrast than `accent`.
- Never rely on color alone. Pair semantic colors with text or an icon (e.g. a down arrow with the green, not just green).

### Reduced motion

- The global `prefers-reduced-motion: reduce` rule collapses animations and transitions. All flows must remain fully usable with motion off; never hide meaning behind animation.

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd/Ctrl + K` | Paste a product URL to save (quick add) |
| `Cmd/Ctrl + N` | Manual add (enter product details by hand) |
| `Esc` | Close the active sheet, modal, or popover |

- Shortcuts are discoverable (shown in tooltips and the relevant affordances) and never the only way to do something.
- `Esc` consistently dismisses the topmost transient surface and returns focus to where the user was.

---

*Tailwind v4 CSS-first tokens are defined in `src/app/globals.css` under `@theme`. When this document and the CSS disagree, the CSS is correct — update this file to match.*
