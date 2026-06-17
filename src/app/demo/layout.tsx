import { AppShell } from "@/components/layout/AppShell";
import { HubProvider } from "@/components/hub/HubProvider";
import { getCollectionsWithCounts, getUnreadCount } from "@/lib/mock-data";

/**
 * Public demo shell. Lives OUTSIDE the (app) route group on purpose, so it has
 * no auth gate — anyone can try UniKart before signing up. It reuses the same
 * AppShell + HubProvider, but is fed entirely by the in-memory mock selectors
 * (seeded user_1 data), independent of any session or DATABASE_URL.
 */
export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const unread = getUnreadCount();
  const collections = getCollectionsWithCounts();
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
