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
import { authClient, useSession } from "@/lib/auth-client";
import { friendlyAuthError } from "@/lib/auth-errors";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SettingsSection } from "./SettingsSection";

interface PlanUser {
  plan: "free" | "pro";
}

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
 * Plan & billing. Free users see a calm upgrade card (monthly/annual toggle +
 * a 7-day free-trial button that opens Stripe Checkout via the Better Auth
 * Stripe plugin). Pro users see their status and a "Manage billing" button
 * that opens the Stripe billing portal.
 */
export function PlanBillingCard({ initialUser }: { initialUser: PlanUser }) {
  const { data: session } = useSession();
  const plan = ((session?.user as { plan?: string } | undefined)?.plan ??
    initialUser.plan) as "free" | "pro";

  if (plan === "pro") {
    return <ProBilling />;
  }
  return <UpgradeCard />;
}

function UpgradeCard() {
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
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
      setError(
        friendlyAuthError(error, "We couldn’t start your trial. Please try again."),
      );
      return;
    }
    // On success the plugin redirects to Stripe Checkout — keep the spinner up.
  }

  return (
    <SettingsSection
      title="Plan & billing"
      description="Free covers the essentials. Pro unlocks the full, automatic UniKart."
    >
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
              <Sparkles size={18} />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink">UniKart Pro</h3>
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
          <span className="text-3xl font-semibold tracking-tight text-ink">
            {annual ? "$49" : "$5"}
          </span>
          <span className="text-sm text-slate">{annual ? "/year" : "/month"}</span>
          {annual && (
            <Pill tone="accent" className="ml-1">
              2 months free
            </Pill>
          )}
        </div>

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

        {error && <p className="mt-4 text-xs text-up">{error}</p>}

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

function ProBilling() {
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
        friendlyAuthError(error, "We couldn’t open the billing portal. Please try again."),
      );
      return;
    }
    // On success the plugin redirects to Stripe's portal — keep the spinner up.
  }

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
              <h3 className="text-sm font-semibold text-ink">UniKart Pro</h3>
              <Pill tone="ink" dot>
                Active
              </Pill>
            </div>
            <p className="mt-0.5 text-xs text-slate">
              Unlimited items, instant re-checks, AI gist, and cutouts.
            </p>
          </div>
        </div>
        <Button variant="secondary" onClick={manageBilling} loading={loading}>
          {!loading && <CreditCard size={16} />} Manage billing
        </Button>
      </div>

      {error && (
        <p className="border-t border-line px-5 py-2 text-xs text-up">{error}</p>
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
