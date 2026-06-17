/**
 * UniKart Ops — canonical seed data for feature flags and system settings.
 *
 * Shared by the seed script (prisma/seed-ops.ts) and the Ops UI so the set of
 * known flags/settings is defined once. Idempotent upserts — never destructive.
 */
import { DEFAULT_COST_RATES } from "./cost";

export interface FlagSeed {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
}

/** The 11 product flags. Defaults reflect what's actually live today. */
export const FLAG_SEEDS: FlagSeed[] = [
  { key: "parser_v2", name: "Parser v2", description: "Next-generation URL parser pipeline.", enabled: false },
  { key: "automatic_tracking", name: "Automatic tracking", description: "Scheduled price/stock re-checks for saved products.", enabled: true },
  { key: "universal_cart", name: "Universal Cart", description: "Cross-store cart view.", enabled: true },
  { key: "checkout_assistant", name: "Checkout Assistant", description: "Guided, merchant-hosted checkout flow.", enabled: true },
  { key: "signal_recommendations", name: "Signal", description: "Confidence-gated buy guidance from tracked price history.", enabled: true },
  { key: "weekly_calm_review", name: "Weekly calm review", description: "A gentle weekly summary of saved items.", enabled: false },
  { key: "chrome_extension_api", name: "Chrome extension API", description: "Endpoints for the browser extension save flow.", enabled: false },
  { key: "pro_billing", name: "UniKart Coast billing", description: "Stripe subscriptions for the paid tier.", enabled: true },
  { key: "affiliate_disclosure", name: "Affiliate disclosure", description: "Show affiliate relationship disclosures where applicable.", enabled: false },
  { key: "support_console", name: "Support console", description: "Internal support ticketing tools.", enabled: true },
  { key: "maintenance_mode", name: "Maintenance mode", description: "Emergency kill switch — show a calm maintenance notice.", enabled: false },
];

export interface SettingSeed {
  key: string;
  category: "general" | "costs" | "parser" | "tracking" | "notifications" | "support" | "retention";
  description: string;
  value: unknown;
}

/** Non-secret system configuration. Secrets always stay in env vars. */
export const SETTING_SEEDS: SettingSeed[] = [
  // Cost rate config (USD per unit) — seeded from DEFAULT_COST_RATES, editable.
  {
    key: "cost.rates",
    category: "costs",
    description: "Per-unit cost estimates (USD) by rate key. Used by the Costs page.",
    value: Object.fromEntries(
      Object.entries(DEFAULT_COST_RATES).map(([k, r]) => [
        k,
        { provider: r.provider, category: r.category, unit: r.unit, unitCostUsd: r.unitCostUsd },
      ]),
    ),
  },
  { key: "tracking.intervalHours", category: "tracking", description: "Hours between scheduled price/stock checks.", value: 6 },
  { key: "tracking.batchSizeProd", category: "tracking", description: "Max products re-checked per scheduled run in production.", value: 3 },
  { key: "parser.timeoutMs", category: "parser", description: "Max time allowed for a single parse before fallback.", value: 8000 },
  { key: "parser.watchlistedDomains", category: "parser", description: "Domains flagged for review (manual watchlist).", value: [] },
  { key: "notifications.dailyCapPerUser", category: "notifications", description: "Soft cap on notifications generated per user per day.", value: 6 },
  { key: "support.defaultPriority", category: "support", description: "Default priority for new support tickets.", value: "normal" },
  { key: "retention.analyticsDays", category: "retention", description: "Days to retain AnalyticsEvent rows.", value: 365 },
  { key: "retention.apiUsageDays", category: "retention", description: "Days to retain APIUsageEvent rows.", value: 180 },
  { key: "retention.auditDays", category: "retention", description: "Days to retain AdminAuditLog rows (audit retention).", value: 730 },
];
