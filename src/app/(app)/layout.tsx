import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { HubProvider } from "@/components/hub/HubProvider";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getCollectionsWithCounts, getUnreadCount } from "@/lib/data";

/**
 * Server-side gate for the authenticated app (dashboard, collections, cart,
 * products, notifications, settings). We resolve the Better Auth session here
 * — NOT in middleware (Netlify doesn't run the Next middleware runtime the way
 * we'd need) — and redirect anyone without a session to /sign-in.
 *
 * The public marketing page (/), /demo, the sign-in/sign-up/verify pages, and
 * the og/twitter/manifest routes live OUTSIDE this group, so they stay
 * reachable without an account.
 */
export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const [unread, collections] = await Promise.all([
    getUnreadCount(),
    getCollectionsWithCounts(),
  ]);
  return (
    <HubProvider userId={user.id}>
      <AppShell
        unread={unread}
        collections={collections.map((c) => ({ id: c.id, name: c.name }))}
        user={{ name: user.name, email: user.email, image: user.image }}
      >
        {children}
      </AppShell>
    </HubProvider>
  );
}
