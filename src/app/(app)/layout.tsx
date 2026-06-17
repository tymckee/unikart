import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { HubProvider } from "@/components/hub/HubProvider";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getCollectionsWithCounts, getUnreadCount } from "@/lib/data";
import { hasDatabase, prisma } from "@/lib/db";

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

  // An admin-disabled account can't use the app. Best-effort (defaults to
  // allow if the lookup fails) so a transient DB hiccup never locks everyone
  // out. NOTE: redirect() must run OUTSIDE the try (it throws a control-flow
  // signal that the catch would otherwise swallow).
  let disabled = false;
  if (hasDatabase()) {
    try {
      const row = await prisma.user.findUnique({
        where: { id: user.id },
        select: { status: true },
      });
      disabled = row?.status === "disabled";
    } catch {
      // ignore — fall through and allow
    }
  }
  if (disabled) redirect("/sign-in?disabled=1");

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
