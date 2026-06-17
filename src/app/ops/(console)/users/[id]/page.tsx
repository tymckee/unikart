import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Folder,
  ShoppingCart,
  Bell,
  Activity,
  StickyNote,
  ShieldCheck,
} from "lucide-react";
import { getOpsViewer } from "@/lib/ops/viewer";
import { can, permissionsFor, asRole, ROLE_META } from "@/lib/ops/permissions";
import { getUserDetail } from "@/lib/ops/data/users";
import { getAuditForUser } from "@/lib/ops/data/audit";
import { dateTime, shortDate, num } from "@/lib/ops/format";
import { OpsPageHeader, OpsSection } from "@/components/ops/OpsPageHeader";
import { OpsKeyValue } from "@/components/ops/OpsKeyValue";
import { OpsStatusPill } from "@/components/ops/OpsStatusPill";
import { OpsMetricCard } from "@/components/ops/OpsMetricCard";
import { OpsAuditTrail } from "@/components/ops/OpsAuditTrail";
import { GlassCard } from "@/components/ui/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { UserActions, AddNoteForm } from "@/components/ops/users/UserActions";
import {
  addSupportNote,
  changeRole,
  disableUser,
  enableUser,
  resetOnboarding,
  requestDataExport,
  queueDataDeletion,
  setTestAccount,
  setInternal,
} from "@/lib/ops/actions/users";

/**
 * User detail — a calm, scannable read on one person: profile, role &
 * permissions, plan/billing (no card data), usage, collections, cart, recent
 * notifications/events/notes, audit history, and privacy requests.
 */
export const dynamic = "force-dynamic";

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getOpsViewer();

  const [user, auditEntries] = await Promise.all([
    getUserDetail(id),
    getAuditForUser(id, 12),
  ]);

  if (!user) notFound();

  const viewerRole = asRole(viewer?.role);
  const perms = {
    note: can(viewer, "users.note"),
    role: can(viewer, "users.role"),
    disable: can(viewer, "users.disable"),
    mutate: can(viewer, "users.mutate"),
  };
  const hasAnyAction = perms.note || perms.role || perms.disable || perms.mutate;

  const targetRole = asRole(user.role);
  const grantedPermissions = [...permissionsFor(targetRole)].sort();

  return (
    <>
      <div className="mb-4">
        <Link
          href="/ops/users"
          className="inline-flex items-center gap-1.5 text-sm text-slate transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} />
          Back to users
        </Link>
      </div>

      <OpsPageHeader
        title={user.name || "Unnamed user"}
        description={"Member since " + shortDate(user.createdAt)}
        actions={
          <div className="flex items-center gap-2">
            <OpsStatusPill status={user.status} />
            {user.isTestAccount && <Pill tone="outline">Test</Pill>}
            {user.isInternal && <Pill tone="outline">Internal</Pill>}
          </div>
        }
      />

      {/* Actions */}
      {hasAnyAction && (
        <OpsSection title="Actions">
          <UserActions
            user={{
              id: user.id,
              name: user.name,
              role: user.role,
              status: user.status,
              isTestAccount: user.isTestAccount,
              isInternal: user.isInternal,
            }}
            viewerRole={viewerRole}
            perms={perms}
            actions={{
              changeRole,
              disableUser,
              enableUser,
              resetOnboarding,
              requestDataExport,
              queueDataDeletion,
              setTestAccount,
              setInternal,
            }}
          />
        </OpsSection>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: profile, role, billing */}
        <div className="space-y-6 lg:col-span-1">
          <OpsSection title="Profile">
            <GlassCard className="p-5">
              <OpsKeyValue
                items={[
                  { label: "Name", value: user.name || "—" },
                  { label: "Email", value: user.email, sensitive: true },
                  {
                    label: "Email verified",
                    value: user.emailVerified ? "Yes" : "No",
                  },
                  { label: "User id", value: user.id, mono: true },
                  { label: "Joined", value: dateTime(user.createdAt) },
                  {
                    label: "Last active",
                    value: user.lastActiveAt ? dateTime(user.lastActiveAt) : "—",
                  },
                  {
                    label: "Onboarding",
                    value: user.onboardingCompletedAt
                      ? "Completed " + shortDate(user.onboardingCompletedAt)
                      : "Not completed",
                  },
                  {
                    label: "Account",
                    value: <OpsStatusPill status={user.status} />,
                  },
                  ...(user.disabledAt
                    ? [{ label: "Disabled", value: dateTime(user.disabledAt) }]
                    : []),
                  {
                    label: "Flags",
                    value:
                      user.isTestAccount || user.isInternal
                        ? [user.isTestAccount && "Test", user.isInternal && "Internal"]
                            .filter(Boolean)
                            .join(" · ")
                        : "—",
                  },
                ]}
              />
            </GlassCard>
          </OpsSection>

          <OpsSection title="Role & permissions">
            <GlassCard className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <ShieldCheck size={16} className="text-slate" />
                <span className="text-sm font-medium text-ink">{ROLE_META[targetRole].label}</span>
                <OpsStatusPill status={targetRole.toLowerCase()} label={targetRole} />
              </div>
              <p className="mb-3 text-xs text-slate text-pretty">
                {ROLE_META[targetRole].description}
              </p>
              {grantedPermissions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {grantedPermissions.map((p) => (
                    <span
                      key={p}
                      className="rounded-md bg-canvas px-1.5 py-0.5 font-mono text-[0.6875rem] text-slate"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate">No Ops permissions (customer account).</p>
              )}
            </GlassCard>
          </OpsSection>

          <OpsSection title="Plan & billing">
            <GlassCard className="p-5">
              <OpsKeyValue
                items={[
                  {
                    label: "Plan",
                    value:
                      user.plan === "pro" ? (
                        <Pill tone="accent">UniKart Coast</Pill>
                      ) : (
                        <Pill tone="neutral">Free</Pill>
                      ),
                  },
                  ...(user.subscription
                    ? [
                        {
                          label: "Subscription",
                          value: <OpsStatusPill status={user.subscription.status} />,
                        },
                        {
                          label: "Plan key",
                          value: user.subscription.plan,
                        },
                        {
                          label: "Billing",
                          value: user.subscription.billingInterval
                            ? "Per " + user.subscription.billingInterval
                            : "—",
                        },
                        {
                          label: user.subscription.cancelAtPeriodEnd ? "Ends" : "Renews",
                          value: user.subscription.periodEnd
                            ? dateTime(user.subscription.periodEnd)
                            : "—",
                        },
                        ...(user.subscription.trialEnd
                          ? [
                              {
                                label: "Trial ends",
                                value: dateTime(user.subscription.trialEnd),
                              },
                            ]
                          : []),
                      ]
                    : [
                        {
                          label: "Subscription",
                          value: "None",
                        },
                      ]),
                ]}
              />
              <p className="mt-3 text-xs text-silver">
                UniKart only bills the UniKart Coast subscription, via Stripe. No card data is
                stored here.
              </p>
            </GlassCard>
          </OpsSection>
        </div>

        {/* Right column: usage, collections, cart, activity, notes */}
        <div className="space-y-6 lg:col-span-2">
          <OpsSection title="Usage">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              <OpsMetricCard
                label="Products saved"
                value={num(user.counts.products)}
                icon={<Folder size={16} />}
              />
              <OpsMetricCard label="Collections" value={num(user.counts.collections)} />
              <OpsMetricCard
                label="Cart items"
                value={num(user.counts.cartItems)}
                icon={<ShoppingCart size={16} />}
              />
              <OpsMetricCard
                label="Alerts enabled"
                value={num(user.counts.enabledAlerts)}
                hint={num(user.counts.alerts) + " total"}
                icon={<Bell size={16} />}
              />
              <OpsMetricCard label="Notifications" value={num(user.counts.notifications)} />
            </div>
          </OpsSection>

          <div className="grid gap-6 md:grid-cols-2">
            <OpsSection title="Collections">
              {user.collections.length > 0 ? (
                <GlassCard className="divide-y divide-line p-2">
                  {user.collections.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <span className="truncate text-sm text-ink">{c.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-slate">
                        {num(c.productCount)} items
                      </span>
                    </div>
                  ))}
                </GlassCard>
              ) : (
                <GlassCard className="px-5 py-8 text-center text-sm text-slate">
                  No collections yet.
                </GlassCard>
              )}
            </OpsSection>

            <OpsSection title="Universal Cart">
              {user.cart ? (
                <GlassCard className="p-5">
                  <OpsKeyValue
                    items={[
                      { label: "Cart", value: user.cart.name },
                      {
                        label: "Status",
                        value: <OpsStatusPill status={user.cart.status} />,
                      },
                      { label: "Items", value: num(user.cart.itemCount) },
                    ]}
                  />
                </GlassCard>
              ) : (
                <GlassCard className="px-5 py-8 text-center text-sm text-slate">
                  No Universal Cart yet.
                </GlassCard>
              )}
            </OpsSection>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <OpsSection title="Recent notifications">
              {user.notifications.length > 0 ? (
                <GlassCard className="divide-y divide-line p-2">
                  {user.notifications.map((n) => (
                    <div key={n.id} className="px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm text-ink">{n.title}</span>
                        {!n.read && <Pill tone="accent">Unread</Pill>}
                      </div>
                      <p className="mt-0.5 text-xs text-silver tabular-nums">
                        {dateTime(n.createdAt)}
                      </p>
                    </div>
                  ))}
                </GlassCard>
              ) : (
                <GlassCard className="px-5 py-8 text-center text-sm text-slate">
                  No notifications yet.
                </GlassCard>
              )}
            </OpsSection>

            <OpsSection title="Recent events">
              {user.events.length > 0 ? (
                <GlassCard className="divide-y divide-line p-2">
                  {user.events.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <Activity size={14} className="shrink-0 text-silver" />
                        <span className="truncate text-sm text-ink">{e.eventName}</span>
                      </span>
                      <span className="shrink-0 text-xs text-silver tabular-nums">
                        {dateTime(e.createdAt)}
                      </span>
                    </div>
                  ))}
                </GlassCard>
              ) : (
                <GlassCard className="px-5 py-8 text-center text-sm text-slate">
                  No analytics events yet.
                </GlassCard>
              )}
            </OpsSection>
          </div>

          <OpsSection
            title="Support notes"
            description="Internal notes — never visible to the customer."
          >
            <GlassCard className="space-y-4 p-5">
              {perms.note && <AddNoteForm userId={user.id} addSupportNote={addSupportNote} />}
              {user.supportNotes.length > 0 ? (
                <ul className="divide-y divide-line">
                  {user.supportNotes.map((s) => (
                    <li key={s.id} className="flex gap-3 py-3 first:pt-0">
                      <StickyNote size={15} className="mt-0.5 shrink-0 text-silver" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink text-pretty">{s.body}</p>
                        <p className="mt-0.5 text-xs text-silver tabular-nums">
                          {dateTime(s.createdAt)}
                          {s.visibility !== "internal" ? " · " + s.visibility : ""}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate">No notes yet.</p>
              )}
            </GlassCard>
          </OpsSection>

          <OpsSection
            title="Privacy requests"
            description="Export and deletion are always available, regardless of plan."
          >
            {user.dataRequests.length > 0 ? (
              <GlassCard className="divide-y divide-line p-2">
                {user.dataRequests.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <span className="text-sm capitalize text-ink">{d.type}</span>
                      {d.requestedById && (
                        <span className="ml-2 text-xs text-silver">admin-queued</span>
                      )}
                      <p className="text-xs text-silver tabular-nums">
                        {dateTime(d.createdAt)}
                        {d.completedAt ? " · done " + shortDate(d.completedAt) : ""}
                      </p>
                    </div>
                    <OpsStatusPill status={d.status} />
                  </div>
                ))}
              </GlassCard>
            ) : (
              <GlassCard className="px-5 py-8 text-center text-sm text-slate">
                No export or deletion requests.
              </GlassCard>
            )}
          </OpsSection>

          <OpsSection
            title="Audit history"
            description="Admin actions involving this user."
          >
            <GlassCard className="p-5">
              {auditEntries.length > 0 ? (
                <OpsAuditTrail entries={auditEntries} />
              ) : (
                <p className="text-sm text-slate">No audit activity yet.</p>
              )}
            </GlassCard>
          </OpsSection>
        </div>
      </div>
    </>
  );
}
