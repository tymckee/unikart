# UniKart

A calm buying operating system.

UniKart is not a wishlist. It is a quiet place to save what you want, understand when to buy, and check out with less chaos. Paste a link, and the thing you have been thinking about settles into its lane — tracked, organized, and waiting until the moment is right.

The brand is a bike wheel. A hub holds the center. Spokes hold the tension. The rim carries the motion. In UniKart, your collections are **Spokes** and the cart's progress ring is the **Rim** — small metaphors for balance, intent, and forward motion. Premium and quiet, never loud.

---

## What it does

- **Paste a link, save a product.** Drop in a product URL and UniKart captures the title, image, price, and store.
- **Organize into collections.** Group saved products into Spokes that match how you actually think about buying.
- **Track price and stock.** Keep an eye on current, previous, lowest, and highest prices, plus availability over time.
- **Set target alerts.** Choose a price you would be happy to pay and let UniKart watch for it.
- **Guided Universal Cart checkout.** Group everything by merchant, confirm the latest known price and stock, then move through each store in sequence, marking steps complete as you go. Purchased items move to a clean archive. Progress shows as a wheel-rim **Rim** ring.

The goal is steadiness: fewer open tabs, fewer impulse buys, more clarity about when to actually pull the trigger.

---

## What it does NOT do yet

UniKart **does not** perform cross-retailer one-tap checkout. There is no single button that buys everything in your cart across multiple stores at once.

Today the Universal Cart is a **guided assistant**, not an automated purchaser. It groups your items by store, verifies the latest known price and stock, and opens each merchant's own checkout or product page in sequence. **You** complete each purchase on the merchant's site and mark the step done. UniKart never stores payment cards, never asks for store credentials, and never processes payments itself.

Automated and partner-assisted checkout is a future direction (see the [Roadmap](#roadmap)), built on clearly labeled placeholders only — no real partnerships are claimed or implied.

---

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16.2.9 (App Router) |
| UI runtime | React 19.2.4 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 (CSS-first `@theme` in `src/app/globals.css`, PostCSS via `@tailwindcss/postcss`; no `tailwind.config.js`) |
| Motion | framer-motion |
| Icons | lucide-react (thin-line) |
| Class utilities | clsx + tailwind-merge (`cn` helper) |
| Charts | Custom lightweight SVG price chart (no heavy dependency) |
| Data layer | Prisma planned for Phase 2 — SQLite locally, architected to switch to Postgres (provider swap + `DATABASE_URL`), behind a repository/data-access layer |
| Auth | Simple auth abstraction in Phase 1 (mock single-user session), structured to drop in Auth.js (NextAuth v5) later |
| Background jobs | Job abstraction for future price/stock checks; MVP simulates with a manual "Run check now" action |
| Deploy | Netlify (personal account), PWA metadata for future mobile |

---

## Quick start

Requirements: **Node.js >= 20**.

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

---

## Available scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js development server |
| `npm run build` | Build the production bundle |
| `npm run start` | Serve the production build locally |
| `npm run lint` | Run ESLint |

---

## Project structure

```
src/
  app/                      # App Router routes, layout, and global styles
    globals.css             # Tailwind v4 @theme tokens (fonts, surfaces, metals, accents, radii)
    layout.tsx
    page.tsx                # / (landing)
    favicon.ico
  components/               # Shared UI (cards, "spoke" indicators, the Rim ring, the parse loader)
  lib/                      # Domain logic and data access
    types.ts                # Data models (mirror the Prisma schema until Phase 2)
    mock-data.ts            # Seed/sample data for Phase 1
    buy-brain.ts            # Deterministic Buy / Wait / Watch logic (Phase 6)
    utils.ts                # cn() and shared helpers
```

### Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing |
| `/sign-in` | Sign in |
| `/dashboard` | The Hub |
| `/products/[id]` | Product detail and price history |
| `/collections` | Spokes (collections) |
| `/cart` | Universal Cart |
| `/cart/checkout-assistant` | Guided checkout |
| `/notifications` | Alerts and notifications |
| `/settings` | Settings, privacy, and disclosure |
| `/demo` | Guided demo |

> Some routes and the `src/components` directory fill in across the build phases below. `src/lib` is the home for domain types, mock data, Buy Brain, and the data-access layer.

---

## Environment

Phase 1 runs with no required environment variables.

- A committed **`.env.example`** will arrive in **Phase 8** to document configuration.
- **`DATABASE_URL`** is introduced in **Phase 2** for Prisma. Locally it points at SQLite; switching to Postgres is a provider swap plus a new `DATABASE_URL`.

Environment files are git-ignored by default. Never commit real secrets.

---

## Deploy to Netlify

UniKart deploys to a **personal Netlify account**.

1. Push this repository to **your personal GitHub account**.
2. In Netlify, **connect that GitHub repo** as a new site.
3. Set the **build command** to `npm run build`.
4. Publish with the **`@netlify/plugin-nextjs`** plugin (handles Next.js App Router output).
5. Set any required **environment variables** in Netlify (for example, `DATABASE_URL` once Phase 2 lands).

### Set a personal git identity first

This machine's **global git email is a work address**. UniKart is a personal project, so set a personal identity for this repository before you commit or push:

```bash
git config user.name "Your Name"
git config user.email "your-personal-email@example.com"
```

Using `git config` (without `--global`) keeps this scoped to UniKart and leaves your work identity untouched.

---

## Roadmap

UniKart is built in nine phases. Each builds on the last; later phases are clearly labeled as future work.

| Phase | Focus |
| --- | --- |
| 1 | Foundation — design tokens, types, mock data, simple auth abstraction |
| 2 | Persistence — Prisma data layer (SQLite local, Postgres-ready) behind a repository |
| 3 | Product parser — JSON-LD → Open Graph → Twitter card → ecommerce meta → HTML fallback → manual entry |
| 4 | Tracking — price/stock snapshots, target alert rules, notifications, manual "Run check now" |
| 5 | Universal Cart — guided, by-merchant checkout assistant with the Rim progress ring |
| 6 | Buy Brain — deterministic Buy / Wait / Watch from stock, price history, volatility, target, and cart total |
| 7 | Polish — microinteractions, the spinning wheel loader, accessibility, reduced-motion support |
| 8 | Configuration & deploy — `.env.example`, Netlify setup, PWA metadata |
| 9 | Monetization-ready — Free / Pro tiers, optional affiliate disclosure, future partner-checkout placeholders |

---

## Privacy and trust

Shopping data is personal, so UniKart is built around trust.

- **Privacy-first by design.** Export your data, delete your account, and delete individual product history.
- **No payment processing in the MVP.** UniKart never stores payment cards and never asks for store credentials.
- **Respectful fetching.** No anti-bot bypassing and no aggressive scraping; mock adapters stand in where real pages cannot be fetched politely.
- **No fake partnerships.** Future partner and BNPL integrations are placeholders only until real, disclosed agreements exist.

### Affiliate disclosure

UniKart may earn a commission from some links in the future. This is optional and will always be clearly disclosed. Disclosure-ready language lives in **Settings** and the footer, with plain "may earn commission in future" wording. No affiliate relationships are active today.

---

## Documentation

Deeper design and architecture notes live in **`docs/`** (forthcoming). When present, start there for detailed specifications:

- `docs/` — product, design-token, data-model, parser, and checkout-assistant notes.

---

## License

Private — all rights reserved. License terms to be finalized.
