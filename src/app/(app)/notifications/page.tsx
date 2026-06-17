import type { Metadata } from "next";
import { getNotifications } from "@/lib/data";
import { PageHeader } from "@/components/layout/PageHeader";
import { NotificationsView } from "@/components/notifications/NotificationsView";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const notifications = await getNotifications();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Quiet, useful updates — price drops, restocks, and gentle cart reminders."
      />
      <NotificationsView initial={notifications} />
    </div>
  );
}
