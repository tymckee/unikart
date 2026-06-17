# UniKart Ops — Console Guide

UniKart Ops is the internal admin / analytics / operations console for UniKart
staff. It lives in the same monorepo as the customer app, served at `/ops`, and
is isolated by host + auth + role. It is never linked from the customer app and
never indexed.

- **Deployment & access:** `docs/OPS_DEPLOYMENT.md`
- **Security model & hardening:** `docs/OPS_SECURITY.md`
- **Privacy & retention:** `docs/OPS_PRIVACY.md`

---

## 1. Access

- **Local:** `http://localhost:3000/ops` (host gate always allows in dev).
- **Production:** `https://ops.uni-kart.com/ops`. On `uni-kart.com`, `/ops` is 404.
- Sign in at `/ops/sign-in` with your UniKart account (password / magic link /
  passkey). You need an Ops **role** — seed the first OWNER via `ADMIN_EMAILS`.

## 2. Roles (RBAC)

`OWNER` · `ADMIN` · `SUPPORT` · `FINANCE` · `READONLY` can enter Ops; `CUSTOMER`
cannot. Authorization is centralized in `src/lib/ops/permissions.ts` and every
action authorizes through `can(user, "resource.action")`. See
`docs/OPS_SECURITY.md` §4 for the permission map.

## 3. Navigation & pages

The left nav adapts to the operator's role (a FINANCE user never sees Support,
etc.). Sections:

| # | Section | Route | Read perm |
|---|---|---|---|
| 1 | Overview | `/ops` | `overview.read` |
| 2 | Users | `/ops/users`, `/ops/users/[id]` | `users.read` |
| 3 | Products | `/ops/products`, `/ops/products/[id]` | `products.read` |
| 4 | Parser | `/ops/parser` | `parser.read` |
| 5 | Jobs | `/ops/jobs` | `jobs.read` |
| 6 | API Usage | `/ops/api-usage` | `apiUsage.read` |
| 7 | Costs | `/ops/costs` | `costs.read` |
| 8 | Support | `/ops/support`, `/ops/support/[id]` | `support.read` |
| 9 | Notifications | `/ops/notifications` | `notifications.read` |
| 10 | Billing | `/ops/billing` | `billing.read` |
| 11 | Feature Flags | `/ops/feature-flags` | `featureFlags.read` |
| 12 | System Health | `/ops/system` | `system.read` |
| 13 | Audit Log | `/ops/audit` | `audit.read` |
| 14 | Settings | `/ops/settings` | `settings.read` |

Each list page supports server-side search, filters, sort, and pagination via the
URL (no loading all rows into the browser). Sensitive mutations require
confirmation + a reason and produce an audit entry and a toast.

## 4. Architecture

```
src/
  proxy.ts                       # host gate + noindex for /ops, /api/ops
  app/
    robots.ts                    # disallow /ops, /api/ops
    api/health/route.ts          # safe health endpoint
    api/ops/export/*/route.ts    # role-guarded, audited CSV exports
    ops/
      layout.tsx                 # outer: host gate + noindex metadata
      sign-in/page.tsx           # operator sign-in (Better Auth)
      (console)/
        layout.tsx               # auth + RBAC gate + OpsShell
        page.tsx                 # Overview
        <section>/page.tsx       # the 14 sections (+ [id] detail pages)
  lib/ops/
    permissions.ts               # roles, permission catalog, can()
    viewer.ts                    # getOpsViewer() — session → role (DB) + seed
    guard.ts                     # requireOpsPermission / assertOpsApi
    audit.ts                     # recordAdminAudit()
    analytics.ts                 # trackEvent()
    api-usage.ts                 # recordApiUsage()
    cost.ts                      # recordCost() + DEFAULT_COST_RATES
    jobs.ts                      # recordJobRun() / trackJob()
    parse-attempt.ts             # recordParseAttempt()
    host.ts env.ts request-context.ts sanitize.ts format.ts metrics.ts
    nav.ts types.ts seed-data.ts
    data/                        # per-section read modules (+ shared audit.ts, common.ts)
    actions/                     # per-section server actions ("use server")
  components/ops/                # OpsShell, OpsSidebar, OpsTopbar, OpsDataTable,
                                 # OpsMetricCard, OpsChartCard, Charts, OpsFilterBar,
                                 # OpsStatusPill, OpsActionMenu, OpsConfirmDialog,
                                 # OpsReasonDialog, OpsAuditTrail, OpsEmptyState,
                                 # OpsComingSoon, OpsAccessDenied, OpsWheelHealth, …
```

### Telemetry recorders (wire these into app code over time)

Best-effort, no-DB-safe helpers that feed the dashboards with **real** data:

- `trackEvent(name, opts)` — product analytics (`AnalyticsEvent`).
- `recordApiUsage(input)` / `withApiUsage(base, work)` — request telemetry.
- `recordCost(input)` / `recordCostByRate(key, qty)` — cost ledger.
- `recordJobRun(input)` / `trackJob(type, work)` — background job runs.
- `recordParseAttempt(input)` — parser outcomes (powers the Parser page).

Until these are called from the app's hot paths, the corresponding dashboards
show **clearly-labelled demo data** (every demo figure carries a `DemoBadge`).
Real DB-backed sections (Users, Products, Notifications, Billing, Feature Flags,
Settings, Audit, System) show live data immediately.

## 5. Data honesty

UniKart never fabricates data. Where a metric has no real data yet, the UI either
shows a calm empty state or labels the value as demo. A blank price beats a made-
up one — the same rule the customer app follows.

## 6. Not built in v1 (intentional)

- **True customer impersonation** — only a read-only "support context view." The
  `users.impersonate` permission is reserved/unused.
- **Live billing actions** — refunds/credits/cancellations are stubbed and
  disabled (Stripe is in test mode; billing is read-only from the local DB).
- **Real outbound email from Ops actions** — resend/notify actions record intent
  + audit; no email is sent (no email infra wired to Ops mutations).
- **Automated scraping/reparse from admin actions** — reparse / check-now queue a
  `JobRun` and audit; they do not scrape inline (and never bypass anti-bot).
- **Domain rules engine** — placeholder; parser watchlist + notes are real.
- **Scheduled retention cleanup** — retention policy is configured; the purge job
  is future work (see `docs/OPS_PRIVACY.md`).
- **Some product flags** (e.g. "disable tracking", "needs review") are recorded
  in the audit log as intent in v1 (no dedicated schema column yet).

## 7. Tests

See `src/lib/ops/__tests__` (Vitest): permission helper, host gate, sanitizer,
metrics helpers, and audit/recorder behaviour. Run with `npm test`.
