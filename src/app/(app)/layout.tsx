import { AppShell } from "@/components/layout/AppShell";
import { HubProvider } from "@/components/hub/HubProvider";
import { getUnreadCount } from "@/lib/mock-data";

export default function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HubProvider>
      <AppShell unread={getUnreadCount()}>{children}</AppShell>
    </HubProvider>
  );
}
