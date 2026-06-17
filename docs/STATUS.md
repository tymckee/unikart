# UniKart — Status & "pick up here"

A snapshot for any new session (or you) to get oriented fast. For the *live* running status, the persistent project memory is canonical; this is the committed reference. Brand rules: see `docs/BRAND.md` (and `CLAUDE.md`).

_Last updated: 2026-06-17._

---

## What UniKart is
A calm, Apple-inspired "buying operating system": paste a product link → save it → organize into Collections → track price/stock → buy when it feels right ("Signal"). Domain **uni-kart.com**. Personal venture (see Identity below). Eventually native iOS/Android apps.

## Stack
Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind v4 (CSS-first `@theme` in `globals.css`) · Prisma 6 → **Neon Postgres** · Better Auth · Stripe · Resend · ScraperAPI · deployed on **Netlify** (auto-deploy on push to `main`; build runs `prisma migrate deploy && next build`). DNS/email on **Cloudflare** + iCloud.

## What's built and LIVE on uni-kart.com
- **Marketing site** (`/`) + public **`/demo`** (no account) + the gated app.
- **Auth (Better Auth, multi-user):** email/password + email verification, magic link, **passkeys/biometric**; profile/settings (account, passkeys, password, sessions, delete). App routes gated; every query scoped to the session user. `src/lib/auth.ts`, `auth-client.ts`, `/api/auth/[...all]`.
- **Database:** Neon Postgres (local dev + prod). Data seam `src/lib/data.ts` (Prisma when `DATABASE_URL` set, else mock fallback). Server actions in `src/lib/actions.ts`.
- **Product ingestion:** paste → `src/lib/parser/` (polite fetch / honest URL fallback, SSRF-guarded) → save fast → **background enrichment** (`src/lib/enrich.ts` + `enrich-compute.ts` via `netlify/functions/enrich-product-background.mts`) scrapes real price/image/specs through **ScraperAPI** (Amazon structured endpoint works on free tier) + AI-cleans the name/specs.
- **Real price tracking:** `netlify/functions/price-check-scheduled.mts` (every 6h) → re-scrapes → real PriceSnapshots + drop/stock alerts (`src/lib/jobs/price-stock.ts`). No more simulation.
- **AI "the gist"** (Claude Haiku, `src/lib/ai/`), social share cards (`src/lib/og.tsx`), local image **cutouts** (imgly, dev-only).
- **Email:** sending from `no-reply@uni-kart.com` (Resend, domain verified); receiving at `tyler@uni-kart.com` + catch-all (iCloud+ Custom Domain).
- **Billing (Stripe, TEST mode):** **UniKart Coast** — $5/mo or $49/yr, **7-day trial, card required, auto-renew**, via `@better-auth/stripe` (Settings → Plan & billing). Internal plan key stays `"pro"`.

## Architecture notes / key constraints
- **Netlify free functions cap at 10s.** Slow work (scraping 5–16s) must NOT run in a request/server-action — it runs in **`-background` / scheduled Netlify Functions** (15-min budget) which then POST results to a fast Next route (the "split" pattern; see enrich + tracking). Those functions must stay **Prisma-free** (esbuild can't bundle Prisma); they call back into CRON_SECRET-gated Next routes that do the DB write.
- **Do NOT set `NPM_FLAGS=--omit=optional`** — it strips lightningcss's native binary and breaks the Tailwind v4 build.
- Better Auth state-changing endpoints need an `Origin` header (CSRF) — normal browsers send it; curl tests must add it.
- `prisma migrate deploy` runs at build; migrations are committed.

## Secrets (on this machine, never in chat/git)
`~/.secrets/`: `cf-unikart.token` (Cloudflare), `netlify-unikart.token`, `unikart-neon.env` (DB URLs), `unikart-resend.token`, `unikart-stripe.token` (TEST sk), **`unikart-stripe-live.token` (LIVE sk, held for go-live)**, `unikart-prod.env` (prod CRON_SECRET), `unikart-anthropic.env`, `unikart-scraperapi.token`. Local `.env` (gitignored) has all the runtime vars. Netlify env mirrors them.

## Open roadmap / pick up here
1. **Stripe go-live** (account is activated): recreate product/prices/webhook in LIVE mode with the held live key, swap the 4 Netlify Stripe vars, redeploy. (Say "go live".)
2. **Category attributes + dimension graphics** — clothing measurements / furniture W×D×H SVG (designed, not built).
3. **Production cutouts** — floating product images live (needs Cloudflare R2 worker; works locally today).
4. **Wider store coverage** — Best Buy/Target/Walmart auto-price needs ScraperAPI premium (~$49/mo); Amazon is free.
5. **Keepa** — instant multi-year Amazon price-history graphs (~$55–75/mo).
6. Backlog: Stripe wallet/saved-shipping, price comparison across stores, agentic checkout, promo codes, browser-extension wishlist import, **native mobile apps**.

## Identity (critical)
Personal venture, separate from work (Affordable Solar). Use **tymckee / tymckee@me.com**. The machine's global git email is the *work* email and the active `gh` account drifts to **`tymckee3` (work)** — **run `gh auth switch --user tymckee` before every push**. Repo: `github.com/tymckee/unikart`. (The repo has a local git identity + `useConfigOnly` guard.)
