"use client";

import { useState } from "react";
import {
  Check,
  CreditCard,
  Infinity as InfinityIcon,
  RefreshCw,
  Scissors,
  Sparkles,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { friendlyBillingError } from "@/lib/auth-errors";
import type { BillingInfo } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SettingsSection } from "./SettingsSection";

const PRO_BENEFITS: { icon: React.ReactNode; label: string; detail: string }[] =
  [
    {
      icon: <InfinityIcon size={16} />,
      label: "Unlimited saved items",
      detail: "Track everything you're considering — no 15-item cap.",
    },
    {
      icon: <RefreshCw size={16} />,
      label: "Instant re-checks",
      detail: "Refresh price and stock on demand, whenever you want.",
    },
    {
      icon: <Sparkles size={16} />,
      label: "AI “the gist” on everything",
      detail: "A calm summary and the specs that matter, on every save.",
    },
    {
      icon: <Scissors size={16} />,
      label: "Product cutouts",
      detail: "Clean, background-removed shots across your collections.",
    },
  ];

/**
 * Plan & billing. State is resolved server-side from the Subscription row in
 * Neon and passed in as `billing` (the source of truth) — the client session
 * doesn't reliably carry the custom `plan` field, so we never infer plan here.
 *
 * - An active/trialing/past_due subscription renders the Pro state with a
 *   "Manage billing" button and NO upgrade button, so a stale re-click can't
 *   trigger the "already subscribed" Stripe error.
 * - Otherwise we render the calm upgrade card (monthly/annual toggle + a 7-day
 *   free-trial button that opens Stripe Checkout via the Better Auth plugin).
 */
export function PlanBillingCard({ billing }: { billing: BillingInfo }) {
  if (billing.active) {
    return <ProBilling billing={billing} />;
  }
  return <UpgradeCard />;
}

function UpgradeCard() {
  // Default to Annual — the calm "best value" option (no urgency, no pressure).
  const [cycle, setCycle] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const annual = cycle === "annual";

  async function startTrial() {
    setLoading(true);
    setError(null);
    const { error } = await authClient.subscription.upgrade({
      plan: "pro",
      annual,
      successUrl: "/settings?upgraded=1",
      cancelUrl: "/settings",
    });
    if (error) {
      setLoading(false);
      setError(friendlyBillingError(error));
      return;
    }
    // On success the plugin redirects to Stripe Checkout — keep the spinner up.
  }

  return (
    <SettingsSection
      title="Plan & billing"
      description="Free covers the essentials. Coast lets the wheel keep turning on its own."
    >
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
              <Sparkles size={18} />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">UniKart Coast</h3>
              <p className="text-xs text-slate">
                Everything you save, watched for you.
              </p>
            </div>
          </div>
          <SegmentedControl
            size="sm"
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "annual", label: "Annual" },
            ]}
            value={cycle}
            onChange={(v) => setCycle(v as "monthly" | "annual")}
          />
        </div>

        {/* Price */}
        <div className="mt-5 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-tight text-ink tabular-nums">
            {annual ? "$49" : "$5"}
          </span>
          <span className="text-sm text-slate">{annual ? "/year" : "/month"}</span>
          {annual && (
            <Pill tone="accent" className="ml-1">
              Best value
            </Pill>
          )}
        </div>
        {annual && (
          <p className="mt-1.5 text-xs text-slate">
            2 months free · about $4 a month
          </p>
        )}

        {/* Benefits */}
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {PRO_BENEFITS.map((b) => (
            <li key={b.label} className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-canvas text-accent-ink">
                {b.icon}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">
                  {b.label}
                </span>
                <span className="block text-xs leading-relaxed text-slate">
                  {b.detail}
                </span>
              </span>
            </li>
          ))}
        </ul>

        {error && <p className="mt-4 text-xs text-slate">{error}</p>}

        {/* CTA */}
        <div className="mt-6 flex flex-col gap-2">
          <Button onClick={startTrial} loading={loading} className="w-full sm:w-auto">
            {!loading && <Sparkles size={16} />} Start 7-day free trial
          </Button>
          <p className="text-xs text-slate">
            Card required; cancel anytime; renews automatically at{" "}
            {annual ? "$49/year" : "$5/month"} after your trial.
          </p>
        </div>
      </div>
    </SettingsSection>
  );
}

function ProBilling({ billing }: { billing: BillingInfo }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function manageBilling() {
    setLoading(true);
    setError(null);
    const { error } = await authClient.subscription.billingPortal({
      returnUrl: "/settings",
    });
    if (error) {
      setLoading(false);
      setError(
        friendlyBillingError(
          error,
          "We couldn’t open the billing portal — please try again.",
        ),
      );
      return;
    }
    // On success the plugin redirects to Stripe's portal — keep the spinner up.
  }

  const headline = proHeadline(billing);
  const status = proStatusLine(billing);

  return (
    <SettingsSection
      title="Plan & billing"
      description="Manage your subscription, payment method, and invoices."
    >
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
            <Sparkles size={20} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-ink">{headline.title}</h3>
              <Pill tone={headline.tone} dot>
                {headline.label}
              </Pill>
            </div>
            <p className="mt-0.5 text-xs text-slate">{status}</p>
          </div>
        </div>
        <Button variant="secondary" onClick={manageBilling} loading={loading}>
          {!loading && <CreditCard size={16} />} Manage billing
        </Button>
      </div>

      {error && (
        <p className="border-t border-line px-5 py-2 text-xs text-slate">
          {error}
        </p>
      )}

      <ul className="border-t border-line px-5 py-4">
        {PRO_BENEFITS.map((b) => (
          <li
            key={b.label}
            className="flex items-center gap-2 py-1 text-sm text-slate"
          >
            <Check size={15} className="shrink-0 text-down" />
            {b.label}
          </li>
        ))}
      </ul>
    </SettingsSection>
  );
}

/** The Pro card's title + status Pill, derived from the billing state. */
function proHeadline(billing: BillingInfo): {
  title: string;
  label: string;
  tone: "ink" | "accent" | "neutral";
} {
  if (billing.cancelAtPeriodEnd) {
    return { title: "UniKart Coast", label: "Ending", tone: "neutral" };
  }
  if (billing.status === "trialing") {
    return { title: "UniKart Coast", label: "Free trial", tone: "accent" };
  }
  return { title: "UniKart Coast — Active", label: "Active", tone: "ink" };
}

/** A single calm line under the headline, accurate to the subscription state. */
function proStatusLine(billing: BillingInfo): string {
  if (billing.cancelAtPeriodEnd && billing.periodEnd) {
    return `Your plan ends ${formatBillingDate(billing.periodEnd)}. You'll keep Coast until then.`;
  }
  if (billing.status === "trialing" && billing.trialEnd) {
    return `Free trial — renews ${formatBillingDate(billing.trialEnd)}.`;
  }
  if (billing.status === "past_due") {
    return "There's a payment to sort out — manage billing to keep Coast.";
  }
  if (billing.periodEnd) {
    return `Renews ${formatBillingDate(billing.periodEnd)}.`;
  }
  return "Unlimited items, instant re-checks, AI gist, and cutouts.";
}

function formatBillingDate(value: string): string {
  try {
    return new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "soon";
  }
}
