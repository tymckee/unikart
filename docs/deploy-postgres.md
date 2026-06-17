# Production database — Neon Postgres

Local dev uses SQLite. Production (Netlify) needs a hosted Postgres because
Netlify Functions have a read-only, ephemeral filesystem — SQLite can't persist
there. **Neon** is the recommended choice: serverless Postgres, generous free
tier, instant branching, works great with Prisma.

The schema is already provider-agnostic (enum-like fields are `String`), so the
switch is mechanical.

## You do (≈5 min, needs your account)

1. Create a Neon project at **neon.tech**. Copy two connection strings from the
   dashboard:
   - **Pooled** (has `-pooler` in the host) → app runtime.
   - **Direct** (no `-pooler`) → migrations.
2. Add env vars in **Netlify → Site configuration → Environment variables**:
   - `DATABASE_URL` = the **pooled** string (include `?sslmode=require`)
   - `DIRECT_URL` = the **direct** string
   - `CRON_SECRET` = a long random string (for the price-check endpoint)
3. Drop the Neon URLs into a local file so I can finish the switch securely
   (don't paste them in chat):
   ```bash
   ( umask 077; printf "Paste POOLED url: "; read -rs A; printf "\nPaste DIRECT url: "; read -rs B
     printf 'DATABASE_URL="%s"\nDIRECT_URL="%s"\n' "$A" "$B" > ~/.secrets/unikart-neon.env; echo )
   chmod 600 ~/.secrets/unikart-neon.env
   ```

## I do (once the URLs are saved)

1. `prisma/schema.prisma` → `provider = "postgresql"`, add `directUrl = env("DIRECT_URL")`.
2. Reset the migration history for Postgres (SQLite migration SQL isn't portable):
   delete `prisma/migrations/*`, then `prisma migrate dev --name init` against Neon
   (creates fresh PG migrations) and `prisma db seed`.
3. Make Netlify apply migrations on deploy — set the build command in
   `netlify.toml` to `prisma migrate deploy && next build`.
4. Verify the live site persists saves end-to-end.

## Notes

- Keep using SQLite locally if you prefer (point your local `.env` at a Neon
  **dev branch** to mirror prod exactly, or keep the SQLite file — both work).
- DATABASE_URL / DIRECT_URL are secrets: Netlify env only, never committed
  (`.env*` is gitignored).
