# UniKart Ops — Security

The Ops Console is sensitive internal infrastructure. This document is the
security model, the threat assumptions, and the production hardening checklist.

---

## 1. Principles

- **Not public, not linked.** Ops is never linked from the customer app, never
  indexed, and (in production) only answers on `ops.uni-kart.com`.
- **Defence in depth.** Host gate, auth gate, RBAC gate, and per-action checks
  are independent layers. No single layer is trusted alone.
- **Least privilege.** Five operator roles with scoped permissions; CUSTOMER has
  none. Authorization is centralized in one module.
- **Everything sensitive is audited.** Every admin mutation writes an immutable
  audit row with actor, target, before/after, reason, IP, and user-agent.
- **No secrets, no cards, ever.** The UI never shows secrets, tokens, password
  hashes, or payment-card data; logs never contain them.

---

## 2. Access control layers

| Layer | File | Enforces |
|---|---|---|
| Edge host gate | `src/proxy.ts` | 404 for `/ops` off `OPS_HOST` in prod; `X-Robots-Tag: noindex`. |
| Server host gate | `src/app/ops/layout.tsx` | Same host rule via `notFound()`; `robots` metadata. |
| Auth + RBAC gate | `src/app/ops/(console)/layout.tsx` | Session required; non-operator → Access Denied (logged). |
| Action/API guard | `src/lib/ops/guard.ts` | `requireOpsPermission` / `assertOpsApi` on every mutation + export. |
| Robots | `src/app/robots.ts` | Disallows `/ops`, `/api/ops`. |

The host gate is duplicated on purpose: the proxy is the fast CDN-level layer,
but Netlify (and some targets) can't be assumed to run the proxy for every
request, so the layout enforces the same rule server-side.

---

## 3. Authentication

- Reuses the existing **Better Auth** system (email+password with verification,
  magic link, passkeys). No separate, weaker admin auth. **No shared password.**
- Ops sign-in is at `/ops/sign-in`. There is no "ops password" — operators use
  their own verified accounts.
- The operator's **role is read from the database** (`getOpsViewer`), not from
  the session token (custom user columns aren't reliably carried on the session).

### First-admin seeding

`ADMIN_EMAILS` (env, comma-separated) is an allowlist. An allowlisted email with
no role yet is seeded as **OWNER** on first `/ops` access (persisted + audited).
The allowlist only *seeds* — it never overrides an explicitly-set role, so an
OWNER can later downgrade an allowlisted account. Personal emails are never
hard-coded in source.

---

## 4. Roles & permissions (RBAC)

Single source of truth: `src/lib/ops/permissions.ts`. Permissions are
`resource.action` strings; roles map to permission sets; everything authorizes
through `can(user, permission)`.

| Role | Summary |
|---|---|
| **OWNER** | Everything, incl. admin-team management + owner transfer. |
| **ADMIN** | Most operations. No admin-team management; cannot grant/revoke OWNER. |
| **SUPPORT** | Read users/products, support notes, parse retries, notification resends. No billing/role/flag mutations. |
| **FINANCE** | Billing, costs, usage reporting. No customer-data mutations, no private notes. |
| **READONLY** | View every dashboard. No mutations, no exports. |
| **CUSTOMER** | No Ops access. |

Guardrails enforced in code beyond the permission map:
- Only an **OWNER** can grant or remove the **OWNER** role (the `changeRole`
  action refuses otherwise, even for ADMIN with `users.role`).
- CSV exports require the resource's `.export` permission (OWNER/ADMIN, plus
  FINANCE for billing/costs/usage). READONLY and SUPPORT cannot export.

---

## 5. Audit logging

- Model: `AdminAuditLog` (append-only). Helper: `recordAdminAudit()`.
- **Immutable:** no update/delete path exists in the UI or actions. Audit export
  is read-only and itself audited.
- Captured: `adminUserId`, `adminEmail`, `role`, `action`, `targetType`,
  `targetId`, `targetUserId`, `reason`, `beforeJson`, `afterJson`,
  `metadataJson`, `ipAddress`, `userAgent`, `createdAt`.
- **Audited events** include: role changes, account disable/enable, plan/data
  requests, support notes, product reparse / manual edits / archive-on-behalf,
  parser retries + domain rules, job retry/cancel/manual-run, notification
  resends, feature-flag changes, system-setting changes, all CSV exports, and
  every **denied** access attempt (`access.denied`).
- `before/after/metadata` are **sanitized** (`src/lib/ops/sanitize.ts`) — keys
  matching secrets/credentials/cards are redacted, strings truncated, size
  capped — so the audit log itself never stores a secret.

---

## 6. Data handling

- **No secrets in UI or logs.** Sanitizer strips secret-like and card-like keys
  from any metadata before it's stored. `Account.password` and token columns are
  never selected.
- **No payment-card data.** Billing reads only the local `Subscription` table +
  `User.plan`. Stripe is never queried for card data; refunds/credits are stubbed
  and disabled in v1.
- **PII minimization.** Analytics store hashed IPs, minimal metadata. Audit logs
  store raw IP/UA for the *operator* (internal accountability), not customers.
- **Privacy controls stay free** and are never paywalled (brand non-negotiable).

---

## 7. Impersonation

True customer impersonation is **not built in v1**. The Users detail page is a
read-only "support context view." The `users.impersonate` permission exists but
is unused; if introduced later it must be read-only, clearly labelled, and
heavily audited.

---

## 8. Production hardening checklist

- [ ] `ADMIN_EMAILS` set to the minimum necessary owner(s); rotate when staff change.
- [ ] `ALLOW_OPS_ON_PUBLIC_HOST=false` in production.
- [ ] `OPS_HOST=ops.uni-kart.com` and the domain attached in Netlify.
- [ ] Confirm `uni-kart.com/ops` → 404 and `ops.uni-kart.com/ops` → sign-in.
- [ ] Confirm `X-Robots-Tag: noindex, nofollow` on `/ops` responses; robots.txt disallows `/ops`.
- [ ] `BETTER_AUTH_SECRET` is strong and set in prod (also salts the analytics IP hash).
- [ ] Operators use passkeys or strong, verified passwords (no shared logins).
- [ ] Review the Audit Log after granting any new operator access.
- [ ] Periodically review the admin team (Settings → Admin team) and downgrade stale accounts.
- [ ] Keep `ENABLE_OPS_CONSOLE` available as a kill switch; `maintenance_mode` flag for the customer app.
- [ ] No secrets committed; `.env` is gitignored; secrets remain in env / `~/.secrets`.

---

## 9. Out of scope / explicit non-actions

- No bypassing retailer anti-bot systems; no aggressive scraping from admin
  actions; no storing retailer cookies or customer store credentials.
- No real emails sent from admin actions (no email infra wired to Ops mutations).
- No live financial actions (refunds/transfers) — stubbed and disabled.
