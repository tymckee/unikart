# UniKart Ops — Deployment & Access

How to run the internal Ops Console locally and how to stand it up at
**ops.uni-kart.com** in production. Ops lives in the same Next.js monorepo as the
customer app but is isolated by host + auth + role.

> Treat Ops as sensitive internal infrastructure. See `docs/OPS_SECURITY.md`.

---

## 1. Local development

Ops is served at **`/ops`** on the dev server.

```bash
npm run dev
# open http://localhost:3000/ops  → redirects to /ops/sign-in
```

In local/dev (`NODE_ENV !== "production"`) the **host gate always allows** `/ops`,
so you don't need the subdomain locally.

To actually get *in*, your signed-in account needs an Ops role. The fastest path
is the env allowlist:

```bash
# .env (gitignored)
ADMIN_EMAILS="you@example.com"   # your UniKart account email
```

The first time an allowlisted email signs in to `/ops`, it's seeded as **OWNER**
(persisted to `User.role`, and the seed is audited). After that, OWNER/ADMIN can
manage roles from the Users pages.

> No account yet? Create one in the normal app (`/sign-up`), verify the email,
> then sign in at `/ops/sign-in` (password, magic link, or passkey — same Better
> Auth system as the customer app).

---

## 2. Environment variables

Add these (already in `.env.example`). Names follow the project's existing style.

| Var | Default | Purpose |
|---|---|---|
| `OPS_HOST` | `ops.uni-kart.com` | Host that serves Ops in production. |
| `ALLOW_OPS_ON_PUBLIC_HOST` | `false` | Allow `/ops` on the customer host too. Keep `false` in prod. |
| `ENABLE_OPS_CONSOLE` | `true` | Master switch — `false` hard-disables Ops (404 everywhere). |
| `ADMIN_EMAILS` | _(empty)_ | Comma-separated emails seeded as OWNER on first sign-in. |
| `OPS_SESSION_TIMEOUT_MINUTES` | `60` | Idle timeout surfaced for Ops sessions. |
| `COST_ESTIMATE_MODE` | `true` | Label cost figures as estimates. |

**Never hard-code personal emails in source.** Set `ADMIN_EMAILS` in `.env`
locally and in the Netlify environment for production. Secrets continue to live
only in env / `~/.secrets` — never in the database, never in the UI.

---

## 3. Production: ops.uni-kart.com

The customer app stays at **uni-kart.com**; Ops answers only on
**ops.uni-kart.com**. On any other host in production, `/ops` returns **404**
(it never reveals that Ops exists).

### 3a. DNS (Cloudflare)

Add a hostname for the subdomain pointing at the same Netlify site as the apex.

1. Cloudflare → `uni-kart.com` zone → **DNS**.
2. Add a record:
   - **Type:** `CNAME`
   - **Name:** `ops`
   - **Target:** your Netlify site's domain, e.g. `unikart.netlify.app`
     (or the apex's existing Netlify target).
   - **Proxy status:** DNS only (grey cloud) is simplest with Netlify's TLS; you
     may proxy (orange) if you prefer Cloudflare in front — Netlify still needs
     the domain attached for routing + certs.

### 3b. Netlify — attach the domain

Because Ops is the **same** Next.js app, you do **not** create a second site.
Add the subdomain as an additional domain alias on the existing site:

1. Netlify → your site → **Domain management → Add a domain**.
2. Add `ops.uni-kart.com`. Netlify provisions a Let's Encrypt cert for it.
3. Confirm both `uni-kart.com` and `ops.uni-kart.com` route to the same deploy.

No separate build, no separate project — the host gate (proxy + layout) does the
isolation in code based on the incoming `Host` header.

### 3c. Netlify — environment

Set on the site's environment (production context):

```
OPS_HOST=ops.uni-kart.com
ALLOW_OPS_ON_PUBLIC_HOST=false
ENABLE_OPS_CONSOLE=true
ADMIN_EMAILS=<the owner email(s)>
COST_ESTIMATE_MODE=true
```

> Do **not** set `NPM_FLAGS=--omit=optional` (breaks the Tailwind v4 build — see
> `docs/STATUS.md`). The existing build command (`prisma migrate deploy && npm run
> build`) already applies the Ops migration on deploy.

### 3d. Verify after deploy

- `https://ops.uni-kart.com/ops` → Ops sign-in (then console for authorized roles).
- `https://uni-kart.com/ops` → **404**.
- `https://uni-kart.com/robots.txt` → disallows `/ops`.
- Response headers on any `/ops` route include `X-Robots-Tag: noindex, nofollow`.
- `https://uni-kart.com/api/health` → minimal `{ status, service, time }`.

---

## 4. How the isolation works (defence in depth)

1. **`src/proxy.ts`** (Next 16 proxy, Node runtime) — fast, edge-level host gate
   on `/ops` + `/api/ops`: 404 off-host in prod, and sets `X-Robots-Tag` on every
   Ops response. Cheap (host header + env only, no DB) so it's reliable.
2. **`src/app/ops/layout.tsx`** — re-checks the host server-side and `notFound()`s
   off-host, and sets `robots: noindex` metadata. This is the guaranteed layer
   even where proxy coverage can't be assumed.
3. **`src/app/ops/(console)/layout.tsx`** — auth + RBAC gate: unauthenticated →
   `/ops/sign-in`; authenticated non-operator → Access Denied (logged).
4. **Every server action / API route** re-checks `can(viewer, permission)` via
   `src/lib/ops/guard.ts`. Belt and braces — never trust a single layer.
5. **`src/app/robots.ts`** disallows `/ops` and `/api/ops`.

---

## 5. Seeding Ops config

Feature flags + system settings are seeded idempotently (safe to re-run; never
deletes data):

```bash
npx tsx prisma/seed-ops.ts
```

This is also safe to run against production (only upserts the known Ops config
rows). The customer-data seed (`npm run db:seed`) is **destructive** and must not
be run against prod.

---

## 6. What's intentionally not built yet

See `docs/OPS_CONSOLE.md` §"Not built in v1" for the full list (true customer
impersonation, live refunds, real email replies from Ops, automated scraping
from admin actions — all deliberately deferred or stubbed for safety).
