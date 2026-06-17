"use client";

import { useState } from "react";
import { CheckCheck, RefreshCw } from "lucide-react";
import type { Notification } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { WheelSpinner } from "@/components/brand/WheelLoader";
import { NotificationCard } from "./NotificationCard";

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
  const [items, setItems] = useState(initial);
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [checking, setChecking] = useState(false);
  const [simIdx, setSimIdx] = useState(0);

  const unreadCount = items.filter((n) => !n.read).length;
  const shown = tab === "unread" ? items.filter((n) => !n.read) : items;

  const markAllRead = () =>
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));

  const runCheck = () => {
    setChecking(true);
    setTimeout(() => {
      const tpl = SIMULATED[simIdx % SIMULATED.length];
      setItems((prev) => [
        {
          ...tpl,
          id: `n_sim_${Date.now()}`,
          read: false,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setSimIdx((i) => i + 1);
      setChecking(false);
    }, 1200);
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
        In this preview, “Run check now” simulates the background price &amp;
        stock job that will run automatically on a schedule.
      </p>
    </div>
  );
}
