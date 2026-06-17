# UniKart Ops — Privacy & Data Retention

UniKart's promise is "shopping without the noise" — calm, honest, on the user's
side. That extends to data: we collect the minimum, never sell or fabricate it,
and keep privacy controls free. This document covers the first-party analytics,
what Ops stores, retention, and how export/deletion work.

---

## 1. First-party analytics (no invasive tracking)

Instead of third-party trackers, UniKart records its own lightweight events via
`trackEvent()` → the `AnalyticsEvent` table.

**Principles**
- **Minimal metadata.** Event name, optional entity type/id, a small sanitized
  metadata blob. No full request bodies. No payment data.
- **Hashed IP only.** `ipHash` is a salted SHA-256 (salt = `BETTER_AUTH_SECRET`),
  truncated — usable for rate analysis, not reversible to an address. The raw IP
  is never stored on analytics rows.
- **Sanitized.** All metadata passes through `src/lib/ops/sanitize.ts`, which
  redacts secret/credential/card-like keys and caps size.

**Tracked events** (`AnalyticsEventName`): `user_signed_up`, `user_logged_in`,
`onboarding_started/completed`, `paste_url_submitted`,
`product_parse_started/succeeded/failed`, `product_saved/edited/released/
archived/marked_purchased`, `collection_created`, `target_price_set`,
`alert_rule_created`, `notification_generated/opened`,
`item_added_to_cart/removed_from_cart`,
`checkout_assistant_started/checkout_step_opened/checkout_assistant_completed`,
`signal_viewed`, `extension_save_started/completed`.

`trackEvent` also best-effort bumps `User.lastActiveAt` for active-user metrics.

---

## 2. What Ops stores about people

| Data | Where | Sensitivity | Notes |
|---|---|---|---|
| Name, email | `User` | PII | Email shown to operators only; marked sensitive in the UI. |
| Saved products, collections, carts, alerts | app tables | personal | Operator-visible for support; never edited without reason + audit. |
| Notifications | `Notification` | personal | Read state only; no open-tracking pixels. |
| Analytics events | `AnalyticsEvent` | low (hashed IP) | Minimal, sanitized. |
| API usage | `APIUsageEvent` | low (hashed IP) | No request bodies. |
| Operator actions | `AdminAuditLog` | internal | Raw operator IP/UA kept for accountability. |

**Never stored / shown:** passwords (only Better Auth's hash, never surfaced),
auth tokens, API keys, secrets, or payment-card data (there is none — Stripe
holds card data, not UniKart).

---

## 3. Retention

Configurable via `SystemSetting` (category `retention`), seeded with sane
defaults. There is no automatic purge job in v1 — these values are the policy of
record and the basis for a future scheduled cleanup job (`JobRun` type `cleanup`).

| Setting | Default | Applies to |
|---|---|---|
| `retention.analyticsDays` | 365 | `AnalyticsEvent` |
| `retention.apiUsageDays` | 180 | `APIUsageEvent` |
| `retention.auditDays` | 730 | `AdminAuditLog` (longer — audit retention) |

> When the cleanup job is implemented, it should delete rows older than these
> windows in batches, and the run itself should be recorded as a `JobRun`.

---

## 4. Data export & deletion (DSAR)

- **Free and unpaywalled** for all users (brand non-negotiable). Users can export
  and delete from their own account settings; the existing Better Auth account
  deletion cascades the user's app data.
- From Ops, support can **queue** an export or deletion on a user's behalf:
  these create a `DataRequest` (`type: export | delete`, `status: pending`,
  `requestedById`). Ops queues the request and audits it — it does **not** delete
  immediately from the admin UI (a deliberate safety gate).
- **On deletion**, PII tied to the user must be removed/anonymized. App tables
  cascade from `User` (Prisma `onDelete: Cascade`). Telemetry tables
  (`AnalyticsEvent`, `APIUsageEvent`) intentionally have **no** foreign key to
  `User` (so they survive normal operations); the deletion flow must explicitly
  scrub or anonymize rows for that `userId`. Audit rows are retained per the audit
  window for accountability but contain no customer payment data.

---

## 5. Operator responsibilities

- Access customer data only for a legitimate support/ops reason; state it — many
  actions require a `reason` that lands in the audit log.
- Don't export customer data without need; exports are permission-gated and
  audited.
- Treat the audit log as the record of who-saw/did-what; it's immutable by design.
