# Production database — Neon Postgres

Local dev uses SQLite today. Production (Netlify) needs hosted Postgres because
Netlify Functions have a read-only, ephemeral filesystem — SQLite can't persist
there. **Neon** is the pick: serverless Postgres, generous free tier, instant
branching, first-class Prisma support.

The schema is already provider-agnostic (enum-like fields are `String`), so the
switch is mechanical. Two non-breaking pieces are **already staged** in the repo:
`binaryTargets = ["native","rhel-openssl-3.0.x"]` in `schema.prisma` and Prisma
in `serverExternalPackages` (next.config.ts) — both required for a working
Netlify deploy, both harmless while still on SQLite.

---

## Pooled vs. direct — the one thing to get right

Neon gives you **two** connection strings that differ only by the host:

| | Host looks like | Used for | Env var |
|---|---|---|---|
| **Pooled** | `ep-foo-123456`**`-pooler`**`.<region>.aws.neon.tech` | app runtime / serverless functions | `DATABASE_URL` |
| **Direct** | `ep-foo-123456.<region>.aws.neon.tech` (no `-pooler`) | schema migrations only | `DIRECT_URL` |

Serverless functions open many short-lived connections and would exhaust
Postgres without the pooler, so the **runtime** uses pooled. Migrations need
session-level statements PgBouncer's transaction mode doesn't support, so they
run over **direct**. Prisma routes CLI commands to `directUrl` automatically.

In the Neon **Connect** modal, the **Connection pooling** toggle flips the shown
string between the two (ON = `-pooler`).

---

## You do (≈5 min — needs your personal account)

1. **Create the Neon project.** Go to **neon.com** (the old neon.tech redirects
   there) and sign up with your **personal** identity (`tymckee@me.com` — keep it
   off the work account; see the personal-venture note). Click **Create project**,
   pick the default Postgres version and the **region closest to you / your
   Netlify region**, leave the database as `neondb`. Create it.

2. **Grab both strings.** On the project dashboard click **Connect**. Copy the
   pooled string (toggle **Connection pooling** ON — host has `-pooler`), then
   toggle it OFF and copy the direct string. Keep the `?sslmode=require&channel_binding=require`
   query params Neon adds.

3. **Drop them into a local secrets file** (never paste secrets in chat). This
   prompt reads them without echoing and appends a cold-start timeout to the
   pooled URL:
   ```bash
   ( umask 077
     printf "Paste POOLED url (-pooler):\n"; read -rs POOLED
     printf "Paste DIRECT url (no -pooler):\n"; read -rs DIRECT
     sep=$([[ "$POOLED" == *\?* ]] && echo '&' || echo '?')
     printf 'DATABASE_URL="%s%sconnect_timeout=15"\nDIRECT_URL="%s"\n' \
       "$POOLED" "$sep" "$DIRECT" > ~/.secrets/unikart-neon.env
     echo "wrote ~/.secrets/unikart-neon.env" )
   chmod 600 ~/.secrets/unikart-neon.env
   ```

4. **Netlify env vars** — pick ONE:
   - **You set them** in Netlify UI → *Site configuration → Environment variables*
     (`DATABASE_URL` = pooled, `DIRECT_URL` = direct, `CRON_SECRET` = long random,
     `ANTHROPIC_API_KEY` if activating real gist). Mark them **Secret** and ensure
     scope includes **Builds + Functions** (the DB URLs are read at both build
     time for migrations and runtime for queries).
   - **I set them for you** — create a Netlify **personal access token** (*User
     settings → Applications → New access token*) and save it to
     `~/.secrets/netlify-unikart.token` (chmod 600). I'll set all four via the
     Netlify API/CLI scoped correctly.

Then tell me it's done.

---

## I do (once the URLs are saved)

1. Flip `schema.prisma`: `provider = "postgresql"`, add `directUrl = env("DIRECT_URL")`.
   (`binaryTargets` + bundler externals are already in place.)
2. Reset migration history for Postgres (SQLite SQL isn't portable): delete
   `prisma/migrations/*`, then `prisma migrate dev --name init` against Neon to
   generate fresh PG migrations, and `prisma db seed`.
3. Point local `.env` at Neon (recommended: a Neon **dev branch** so local work
   never touches prod data; `DATABASE_URL` pooled + `DIRECT_URL` direct).
4. Set the Netlify build command in `netlify.toml` to
   `prisma migrate deploy && npm run build` so each deploy applies pending
   migrations (`migrate deploy`, never `migrate dev`, in CI). `prisma generate`
   already runs in `postinstall`.
5. Set the four Netlify env vars (or confirm yours), redeploy, and verify the
   live site persists a saved product end-to-end.

---

## Notes / gotchas (from current Neon + Prisma + Netlify docs)

- **Prisma 6 needs no driver adapter** for Neon — the plain connection string
  works. `@prisma/adapter-neon` is only for edge runtimes that can't open TCP
  (we're on a normal Node serverless runtime).
- **Don't** add `pgbouncer=true` — Neon's PgBouncer ≥1.21 supports protocol-level
  prepared statements; Prisma recommends omitting it.
- **Free-tier scale-to-zero**: compute suspends after 5 min idle; the first query
  after idle can be slow — `connect_timeout=15` (added above) absorbs the cold
  start.
- **Migrations run over `DIRECT_URL` only** — running them through `-pooler`
  fails on transaction-mode pooling.
- `DATABASE_URL` / `DIRECT_URL` are secrets: Netlify env + local `~/.secrets`
  only, never committed (`.env*` is gitignored).
- The build command change (step 4) is held until the DB + env vars exist —
  adding `prisma migrate deploy` before then would fail the Netlify build.
