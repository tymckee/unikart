"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Download, LogOut, Trash2 } from "lucide-react";
import {
  getCollectionsWithCounts,
  getProductViews,
  mockNotifications,
  mockUser,
} from "@/lib/mock-data";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { Pill } from "@/components/ui/Pill";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SettingsSection, SettingsRow } from "./SettingsSection";

export function SettingsView() {
  const router = useRouter();
  const [frequency, setFrequency] = useState("daily");
  const [watchOnSave, setWatchOnSave] = useState(true);
  const [quietHours, setQuietHours] = useState(true);
  const [affiliate, setAffiliate] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const exportData = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      user: mockUser,
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

  const flash = (msg: string) => {
    setNote(msg);
    setTimeout(() => setNote(null), 3500);
  };

  const confirmDanger = (label: string) => {
    if (
      window.confirm(
        `${label}\n\nThis is a preview build — no real data will be changed.`,
      )
    ) {
      flash(`${label} — preview only, nothing was changed.`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Account */}
      <SettingsSection title="Account">
        <SettingsRow
          label={mockUser.name}
          description={mockUser.email}
          control={<Pill tone="ink">Pro</Pill>}
        />
        <SettingsRow
          label="Sign out"
          description="End your session on this device."
          control={
            <Button variant="ghost" size="sm" onClick={() => router.push("/")}>
              <LogOut size={15} /> Sign out
            </Button>
          }
        />
      </SettingsSection>

      {/* Plan */}
      <SettingsSection
        title="Plan"
        description="Free covers the essentials. Pro unlocks automatic tracking and Buy Brain."
      >
        <div className="grid gap-px bg-line sm:grid-cols-2">
          <PlanCard
            name="Free"
            price="$0"
            features={[
              "Save unlimited products",
              "Basic collections",
              "Manual reminders",
            ]}
          />
          <PlanCard
            name="Pro"
            price="$4/mo"
            current
            features={[
              "Automatic price & stock tracking",
              "Unlimited alerts",
              "Advanced price history",
              "Buy Brain recommendations",
            ]}
          />
        </div>
      </SettingsSection>

      {/* Alerts */}
      <SettingsSection title="Alerts">
        <SettingsRow
          label="Alert frequency"
          description="How often we check the things you're watching."
          control={
            <SegmentedControl
              size="sm"
              options={[
                { value: "realtime", label: "Realtime" },
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
              ]}
              value={frequency}
              onChange={setFrequency}
            />
          }
        />
        <SettingsRow
          label="Watch new saves automatically"
          description="Turn on price alerts the moment you save something."
          control={
            <Switch checked={watchOnSave} onCheckedChange={setWatchOnSave} />
          }
        />
        <SettingsRow
          label="Quiet hours"
          description="Hold non-urgent alerts overnight."
          control={<Switch checked={quietHours} onCheckedChange={setQuietHours} />}
        />
      </SettingsSection>

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
        <SettingsRow
          label="Delete product history"
          description="Clear saved price and stock snapshots."
          control={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => confirmDanger("Delete product history")}
            >
              Clear
            </Button>
          }
        />
        <SettingsRow
          label="Delete account"
          description="Permanently remove your account and all data."
          control={
            <Button
              variant="danger"
              size="sm"
              onClick={() => confirmDanger("Delete account")}
            >
              <Trash2 size={15} /> Delete
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

      {note && (
        <div className="fixed inset-x-0 bottom-24 z-50 mx-auto flex w-fit items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm text-white shadow-float md:bottom-6">
          <Check size={15} className="text-down" />
          {note}
        </div>
      )}
    </div>
  );
}

function PlanCard({
  name,
  price,
  features,
  current,
}: {
  name: string;
  price: string;
  features: string[];
  current?: boolean;
}) {
  return (
    <div className="bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">{name}</h3>
        {current && <Pill tone="accent">Current</Pill>}
      </div>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
        {price}
      </p>
      <ul className="mt-4 space-y-2">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-slate">
            <Check size={15} className="mt-0.5 shrink-0 text-down" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}
