import { Bell, BellRing, MailOpen, Layers } from "lucide-react";
import { OpsPageHeader, OpsSection } from "@/components/ops/OpsPageHeader";
import { OpsMetricCard } from "@/components/ops/OpsMetricCard";
import { OpsChartCard } from "@/components/ops/OpsChartCard";
import { MiniBars, Donut } from "@/components/ops/Charts";
import { OpsDataTable, type OpsColumn } from "@/components/ops/OpsDataTable";
import { OpsFilterBar } from "@/components/ops/OpsFilterBar";
import { OpsStatusPill } from "@/components/ops/OpsStatusPill";
import { OpsEmptyState } from "@/components/ops/OpsEmptyState";
import { DemoBadge } from "@/components/ops/DemoBadge";
import { GlassCard } from "@/components/ui/GlassCard";
import { Pill } from "@/components/ui/Pill";
import {
  NotifRowActions,
  TemplatePreview,
  TemplateManager,
} from "@/components/ops/notifications/NotifActions";
import { getOpsViewer } from "@/lib/ops/viewer";
import { can } from "@/lib/ops/permissions";
import { hasDatabase, prisma } from "@/lib/db";
import {
  getNotifications,
  getNotificationStats,
  notificationTypeLabel,
  NOTIFICATION_TYPES,
  type NotificationView,
} from "@/lib/ops/data/notifications";
import {
  resendNotification,
  markReviewed,
  disableTemplate,
} from "@/lib/ops/actions/notifications";
import { readListParams, makeSortHref, makePageHref } from "@/lib/ops/data/common";
import { dateTime, num, pct, ratioPct, truncate } from "@/lib/ops/format";
import { demoSeries } from "@/lib/ops/metrics";

export const dynamic = "force-dynamic";

const TYPE_FILTER = NOTIFICATION_TYPES.map((t) => ({
  value: t,
  label: notificationTypeLabel(t),
}));

const READ_FILTER = [
  { value: "read", label: "Read" },
  { value: "unread", label: "Unread" },
];

/**
 * Which templates are currently paused (kill-switched), read from the
 * SystemSetting "notifications.disabled.<type>" rows. Guarded + best-effort: a DB
 * hiccup degrades to "none paused" rather than throwing.
 */
async function getDisabledTemplateTypes(): Promise<string[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await prisma.systemSetting.findMany({
      where: { key: { startsWith: "notifications.disabled." } },
      select: { key: true, valueJson: true },
    });
    const out: string[] = [];
    for (const r of rows) {
      let on = false;
      try {
        on = JSON.parse(r.valueJson) === true;
      } catch {
        on = false;
      }
      if (on) out.push(r.key.replace("notifications.disabled.", ""));
    }
    return out;
  } catch (e) {
    console.error("[ops] getDisabledTemplateTypes failed:", e);
    return [];
  }
}

export default async function OpsNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const viewer = await getOpsViewer();
  const canResend = can(viewer, "notifications.resend");
  const canMutate = can(viewer, "notifications.mutate");

  const lp = readListParams(sp, {
    defaultSort: { key: "createdAt", dir: "desc" },
    sortableKeys: ["createdAt", "type", "read"],
    pageSize: 25,
  });

  const [stats, { rows, total }, disabledTypes] = await Promise.all([
    getNotificationStats(),
    getNotifications(lp),
    getDisabledTemplateTypes(),
  ]);

  // Honesty: with no real Notification data, the trend is a clearly-labelled demo
  // series; the read/unread donut and metric values stay blank rather than faked.
  const trend = stats.isDemo
    ? demoSeries("notifications-generated", 30, 18, 14)
    : stats.generatedTrend;

  const readSegments = stats.isDemo
    ? []
    : [
        { name: "Read", value: stats.read },
        { name: "Unread", value: stats.unread },
      ];

  const columns: OpsColumn<NotificationView>[] = [
    {
      key: "type",
      header: "Type",
      sortable: true,
      render: (r) => <OpsStatusPill status="watchlisted" label={notificationTypeLabel(r.type)} dot={false} />,
    },
    {
      key: "title",
      header: "Title",
      render: (r) => (
        <div className="min-w-0">
          <p className="font-medium text-ink">{truncate(r.title, 56)}</p>
          <p className="mt-0.5 truncate text-xs text-slate">{truncate(r.body, 72)}</p>
        </div>
      ),
    },
    {
      key: "userEmail",
      header: "Recipient",
      render: (r) =>
        r.userEmail ? (
          <span className="text-slate">{r.userEmail}</span>
        ) : (
          <span className="text-silver">—</span>
        ),
    },
    {
      key: "product",
      header: "Product",
      render: (r) =>
        r.productId ? (
          r.productTitle ? (
            <a
              href={"/ops/products?q=" + encodeURIComponent(r.productTitle)}
              className="text-accent-ink underline-offset-2 hover:underline"
            >
              {truncate(r.productTitle, 40)}
            </a>
          ) : (
            <span className="font-mono text-xs text-slate">{r.productId.slice(0, 10)}</span>
          )
        ) : (
          <span className="text-silver">—</span>
        ),
    },
    {
      key: "createdAt",
      header: "Created",
      sortable: true,
      align: "right",
      render: (r) => <span className="tabular-nums text-slate">{dateTime(r.createdAt)}</span>,
    },
    {
      key: "read",
      header: "Read",
      sortable: true,
      align: "center",
      render: (r) => <OpsStatusPill status={r.read ? "delivered" : "pending"} label={r.read ? "Read" : "Unread"} />,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      action: true,
      render: (r) => (
        <NotifRowActions
          notif={{ id: r.id, type: r.type, read: r.read }}
          canResend={canResend}
          resendNotification={resendNotification}
          markReviewed={markReviewed}
        />
      ),
    },
  ];

  return (
    <>
      <OpsPageHeader
        title="Notifications"
        description="What UniKart sends to people about their saved items — price moves, stock changes, and cart reminders."
        actions={
          <TemplateManager
            disabledTypes={disabledTypes}
            canMutate={canMutate}
            disableTemplate={disableTemplate}
          />
        }
      />

      <OpsSection title="Overview">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <OpsMetricCard
            label="Generated (total)"
            value={num(stats.total)}
            hint="All notifications on record"
            icon={<Bell size={16} />}
            isDemo={stats.isDemo}
          />
          <OpsMetricCard
            label="Generated (7d)"
            value={num(stats.generated7d)}
            hint="Last 7 days"
            delta={stats.isDemo ? null : stats.delta7d}
            icon={<BellRing size={16} />}
            isDemo={stats.isDemo}
          />
          <OpsMetricCard
            label="Read"
            value={stats.isDemo ? "—" : num(stats.read)}
            hint={stats.isDemo ? undefined : ratioPct(stats.total > 0 ? stats.read / stats.total : 0) + " of all"}
            tone="good"
            icon={<MailOpen size={16} />}
            isDemo={stats.isDemo}
          />
          <OpsMetricCard
            label="Unread"
            value={stats.isDemo ? "—" : num(stats.unread)}
            hint={stats.isDemo ? undefined : "Not yet opened in-app"}
            icon={<Bell size={16} />}
            isDemo={stats.isDemo}
          />
        </div>
        <p className="mt-3 text-xs text-silver">
          The only delivery signal stored today is the in-app read flag. Sends,
          opens, clicks, and bounces aren&rsquo;t tracked yet, so no open or
          delivery rates are shown.
        </p>
      </OpsSection>

      <OpsSection>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <OpsChartCard
            title="Generated over time"
            subtitle="Per-day count, last 30 days"
            isDemo={stats.isDemo}
            className="lg:col-span-2"
          >
            <MiniBars
              data={trend}
              tone="accent"
              height={72}
              ariaLabel="Notifications generated per day over the last 30 days"
            />
          </OpsChartCard>

          <OpsChartCard title="Read vs. unread" subtitle="Across all notifications" isDemo={stats.isDemo}>
            {readSegments.length > 0 ? (
              <Donut
                segments={readSegments}
                centerLabel={pct(stats.readRate, 0)}
                centerSub="read"
              />
            ) : (
              <p className="py-6 text-sm text-silver">No notifications yet.</p>
            )}
          </OpsChartCard>
        </div>
      </OpsSection>

      <OpsSection
        title="By type"
        description="How the volume splits across templates. Pause a noisy one from Manage templates."
      >
        <GlassCard className="p-5">
          {stats.byType.length > 0 ? (
            <ul className="divide-y divide-line">
              {stats.byType.map((t) => {
                // Recover the raw type key from the label for the preview + paused chip.
                const rawType = NOTIFICATION_TYPES.find(
                  (k) => notificationTypeLabel(k) === t.name,
                );
                const paused = rawType ? disabledTypes.includes(rawType) : false;
                return (
                  <li key={t.name} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm text-ink">{t.name}</span>
                      {paused && (
                        <Pill tone="neutral" dot>
                          Paused
                        </Pill>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="tabular-nums text-sm text-slate">{num(t.value)}</span>
                      {rawType && <TemplatePreview type={rawType} />}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex items-center gap-3 py-4">
              <Layers size={16} className="text-silver" />
              <p className="text-sm text-silver">No notifications recorded yet.</p>
              {stats.isDemo && <DemoBadge label="No data" />}
            </div>
          )}
        </GlassCard>
      </OpsSection>

      <OpsSection title="Recent notifications">
        <OpsFilterBar
          searchPlaceholder="Search title, body, or type…"
          filters={[
            { key: "type", label: "Type", options: TYPE_FILTER },
            { key: "read", label: "Status", options: READ_FILTER },
          ]}
        />
        <OpsDataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.id}
          sort={lp.sort ?? undefined}
          sortHref={(k) => makeSortHref("/ops/notifications", lp.params, lp.sort, k)}
          pagination={{
            page: lp.page,
            pageSize: lp.pageSize,
            total,
            hrefForPage: (p) => makePageHref("/ops/notifications", lp.params, p),
          }}
          empty={
            <OpsEmptyState
              title="No notifications yet"
              description="As UniKart sends price, stock, and cart updates, they'll appear here."
            />
          }
        />
      </OpsSection>
    </>
  );
}
