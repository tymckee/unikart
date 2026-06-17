import type { Metadata } from "next";
import { mockNotifications } from "@/lib/mock-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { NotificationsView } from "@/components/notifications/NotificationsView";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Quiet, useful updates — price drops, restocks, and gentle cart reminders."
      />
      <NotificationsView initial={mockNotifications} />
    </div>
  );
}
