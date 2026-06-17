"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, RefreshCw } from "lucide-react";
import type { Notification } from "@/lib/types";
import { markAllNotificationsRead, runPriceCheckNow } from "@/lib/actions";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { WheelSpinner } from "@/components/brand/WheelLoader";
import { NotificationCard } from "./NotificationCard";

// Used only as the no-database fallback (preview deploy with no DATABASE_URL).
const SIMULATED: Array<Omit<Notification, "id" | "createdAt" | "read">> = [
  {
    userId: "user_1",
    productId: "p_aeron",
    type: "price_dropped",
    title: "Price dropped on Herman Miller Aeron",
    body: "Now $1,345 — down $50 since the last check.",
  },
  {
    userId: "user_1",
    productId: "p_peakdesign",
    type: "price_dropped",
    title: "Peak Design Travel Backpack dipped",
    body: "Now $274.95, the lowest in 30 days.",
  },
  {
    userId: "user_1",
    productId: "p_switch2",
    type: "back_in_stock",
    title: "Back in stock: Nintendo Switch 2",
    body: "Available again at Best Buy for $449.",
  },
];

export function NotificationsView({ initial }: { initial: Notification[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [checking, setChecking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Client-only overlays on top of server `initial` (no clobbering on refresh):
  const [simAdded, setSimAdded] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [simIdx, setSimIdx] = useState(0);

  const items = useMemo(() => {
    const base = [...simAdded, ...initial];
    return readIds.size
      ? base.map((n) => (readIds.has(n.id) ? { ...n, read: true } : n))
      : base;
  }, [simAdded, initial, readIds]);

  const unreadCount = items.filter((n) => !n.read).length;
  const shown = tab === "unread" ? items.filter((n) => !n.read) : items;

  const flash = (msg: string) => {
    setNote(msg);
    setTimeout(() => setNote(null), 4000);
  };

  const markAllRead = () => {
    setReadIds(new Set(items.map((n) => n.id))); // optimistic, persists overlay
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  };

  const runCheck = () => {
    setChecking(true);
    startTransition(async () => {
      const res = await runPriceCheckNow();
      if (res.ok) {
        const n = res.data?.notifications ?? 0;
        const pc = res.data?.priceChanges ?? 0;
        flash(
          n
            ? `${n} new update${n === 1 ? "" : "s"}`
            : pc
              ? `${pc} price change${pc === 1 ? "" : "s"} — no new alerts`
              : "No changes this time",
        );
        router.refresh();
      } else {
        // No database (preview deploy): simulate so the demo still moves.
        const tpl = SIMULATED[simIdx % SIMULATED.length];
        setSimAdded((prev) => [
          {
            ...tpl,
            id: `n_sim_${simIdx}_${prev.length}`,
            read: false,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        setSimIdx((i) => i + 1);
        flash("Simulated an update (no database connected)");
      }
      setChecking(false);
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          options={[
            { value: "all", label: "All", count: items.length },
            { value: "unread", label: "Unread", count: unreadCount },
          ]}
          value={tab}
          onChange={(v) => setTab(v as "all" | "unread")}
        />
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={runCheck} disabled={checking}>
            {checking ? <WheelSpinner size={15} /> : <RefreshCw size={15} />}
            {checking ? "Checking…" : "Run check now"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllRead}
            disabled={unreadCount === 0}
          >
            <CheckCheck size={15} /> Mark all read
          </Button>
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={tab === "unread" ? "You're all caught up" : "No notifications yet"}
          description={
            tab === "unread"
              ? "Nothing unread. We'll let you know the moment something changes."
              : "Price drops, restocks, and cart reminders will appear here."
          }
        />
      ) : (
        <div className="space-y-2.5">
          {shown.map((n) => (
            <NotificationCard key={n.id} notification={n} />
          ))}
        </div>
      )}

      <p className="pt-2 text-center text-xs text-silver">
        {note ??
          "Run check now scans every tracked product for price & stock changes — the same job a schedule runs automatically."}
      </p>
    </div>
  );
}
