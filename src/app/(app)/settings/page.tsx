import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { SettingsView } from "@/components/settings/SettingsView";
import { getCurrentUser } from "@/lib/auth-helpers";

export const metadata: Metadata = { title: "Settings" };
// Lives in the auth-gated (app) group: the layout reads the session via
// `headers()`, so this route is dynamic (no static prerender).
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  // The (app) layout already guarantees a session; this is the source of truth
  // for the initial paint. Client-side mutations re-read via useSession.
  const user = await getCurrentUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Settings"
        subtitle="Your account, alerts, and the privacy controls that keep UniKart trustworthy."
      />
      <SettingsView
        initialUser={
          user
            ? {
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image ?? null,
                plan: user.plan,
              }
            : null
        }
      />
    </div>
  );
}
