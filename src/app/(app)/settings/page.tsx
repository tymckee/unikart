import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsView } from "@/components/settings/SettingsView";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Your account, alerts, and the privacy controls that keep UniKart trustworthy."
      />
      <SettingsView />
    </div>
  );
}
