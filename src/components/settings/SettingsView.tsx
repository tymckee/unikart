"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Download, LogOut } from "lucide-react";
import {
  getCollectionsWithCounts,
  getProductViews,
  mockNotifications,
} from "@/lib/mock-data";
import { authClient } from "@/lib/auth-client";
import type { BillingInfo, NotificationPreferences } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { useSignOut } from "@/components/auth/use-sign-out";
import { SettingsSection, SettingsRow } from "./SettingsSection";
import { AccountCard } from "./AccountCard";
import { NotificationsCard } from "./NotificationsCard";
import { PlanBillingCard } from "./PlanBillingCard";
import { ProWelcome } from "./ProWelcome";
import { PasskeysManager } from "./PasskeysManager";
import { ChangePasswordCard } from "./ChangePasswordCard";
import { SessionsManager } from "./SessionsManager";
import { DeleteAccountCard } from "./DeleteAccountCard";

interface InitialUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  plan: "free" | "pro";
}

export function SettingsView({
  initialUser,
  billing,
  notificationPrefs,
}: {
  initialUser: InitialUser | null;
  billing: BillingInfo;
  notificationPrefs: NotificationPreferences;
}) {
  const { signOut, pending: signingOut } = useSignOut();
  const searchParams = useSearchParams();
  const [affiliate, setAffiliate] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [welcome, setWelcome] = useState(false);

  const flash = (msg: string) => {
    setNote(msg);
    setTimeout(() => setNote(null), 3500);
  };

  // Returning from Stripe Checkout (?upgraded=1) → show a calm, intentional
  // welcome moment (rendered below), then clean the URL param. The server prop
  // is the source of truth for plan state; we also nudge the client cache to
  // refresh so any session-derived UI catches up. Deferred to a timeout so we
  // don't setState synchronously in the effect.
  useEffect(() => {
    if (searchParams.get("upgraded") !== "1") return;
    window.history.replaceState(null, "", "/settings");
    void authClient.subscription.list().catch(() => {});
    const t = setTimeout(() => setWelcome(true), 0);
    return () => clearTimeout(t);
  }, [searchParams]);

  const exportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      user: initialUser,
      collections: getCollectionsWithCounts(),
      products: getProductViews(),
      notifications: mockNotifications,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "unikart-data-export.json";
    a.click();
    URL.revokeObjectURL(url);
    flash("Your data export has downloaded.");
  };

  return (
    <div className="space-y-8">
      {/* A quiet welcome after returning from Checkout (?upgraded=1). */}
      {welcome && <ProWelcome onDismiss={() => setWelcome(false)} />}

      {/* Account */}
      {initialUser && <AccountCard initialUser={initialUser} onNotify={flash} />}

      {/* Security */}
      <div className="space-y-6">
        <PasskeysManager onNotify={flash} />

        <SettingsSection
          title="Security"
          description="Keep access to your account in your hands."
        >
          <ChangePasswordCard onNotify={flash} />
          <SettingsRow
            label="Sign out"
            description="End your session on this device."
            control={
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                loading={signingOut}
              >
                {!signingOut && <LogOut size={15} />} Sign out
              </Button>
            }
          />
        </SettingsSection>

        <SessionsManager onNotify={flash} />
      </div>

      {/* Plan & billing */}
      {initialUser && <PlanBillingCard billing={billing} />}

      {/* Notifications — real, persisted email-digest preferences */}
      <NotificationsCard initialPrefs={notificationPrefs} onNotify={flash} />

      {/* Privacy */}
      <SettingsSection
        id="privacy"
        title="Privacy & data"
        description="Your shopping data is sensitive. You're always in control of it."
      >
        <SettingsRow
          label="Export your data"
          description="Download everything UniKart holds about you as JSON."
          control={
            <Button variant="secondary" size="sm" onClick={exportData}>
              <Download size={15} /> Export
            </Button>
          }
        />
      </SettingsSection>

      {/* Affiliate disclosure */}
      <SettingsSection
        id="disclosure"
        title="Affiliate disclosure"
        description="Transparency about how UniKart may earn money in the future."
      >
        <div className="px-5 py-4">
          <p className="text-sm leading-relaxed text-slate">
            UniKart is free to use. In the future, some links to merchants may
            become affiliate links, which means UniKart could earn a small
            commission if you buy through them.{" "}
            <span className="font-medium text-ink">
              This will never change the price you pay
            </span>
            , and we&apos;ll always label affiliate links clearly. UniKart has
            no current partnerships and does not process any payments.
          </p>
        </div>
        <SettingsRow
          label="Show affiliate links when available"
          description="You can opt out at any time."
          control={<Switch checked={affiliate} onCheckedChange={setAffiliate} />}
        />
      </SettingsSection>

      {/* Danger zone */}
      <SettingsSection
        title="Danger zone"
        description="Irreversible actions. Please be sure before you continue."
      >
        <DeleteAccountCard />
      </SettingsSection>

      {note && (
        <div className="fixed inset-x-0 bottom-24 z-50 mx-auto flex w-fit items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm text-white shadow-float md:bottom-6">
          <Check size={15} className="text-down" />
          {note}
        </div>
      )}
    </div>
  );
}
