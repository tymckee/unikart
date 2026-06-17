import { AppShell } from "@/components/layout/AppShell";
import { HubProvider } from "@/components/hub/HubProvider";
import { getCollectionsWithCounts, getUnreadCount } from "@/lib/data";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [unread, collections] = await Promise.all([
    getUnreadCount(),
    getCollectionsWithCounts(),
  ]);
  return (
    <HubProvider>
      <AppShell
        unread={unread}
        collections={collections.map((c) => ({ id: c.id, name: c.name }))}
      >
        {children}
      </AppShell>
    </HubProvider>
  );
}
