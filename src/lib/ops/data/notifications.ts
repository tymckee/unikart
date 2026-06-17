/**
 * UniKart Ops — Notifications data access (notification observability).
 *
 * Reads the Notification table to power /ops/notifications: windowed generated
 * counts, read vs. unread split, a per-type breakdown, a per-day "generated over
 * time" series, and a server-driven paginated table of recent notifications.
 *
 * Honesty notes:
 *  - The only delivery signal we actually store is the `read` boolean. We do NOT
 *    track sends, opens, clicks, or bounces yet — so this module never computes
 *    or returns an "open rate" or "delivery rate". The page states this plainly.
 *  - Every query guards `hasDatabase()` and is wrapped in try/catch, degrading to
 *    an honest empty/zero state rather than throwing or fabricating rows.
 *  - The user email and (where present) product title are joined for display, so
 *    the table can show who a notification went to and what it was about. No
 *    secrets or tokens are ever selected.
 */
import { hasDatabase, prisma } from "@/lib/db";
import type { ListParams } from "./common";
import { windowCounts, bucketByDay, topBy, delta, DAY_MS } from "@/lib/ops/metrics";
import type { ChartPoint, NamedValue } from "@/lib/ops/types";

/** Notification types the app emits (mirrors the Notification.type comment). */
export const NOTIFICATION_TYPES = [
  "price_dropped",
  "target_reached",
  "back_in_stock",
  "out_of_stock",
  "price_increased",
  "cart_reminder",
  "checkout_incomplete",
  "weekly_review",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Human label for a notification type (UI copy — calm, no exclamation marks). */
export const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  price_dropped: "Price dropped",
  target_reached: "Target reached",
  back_in_stock: "Back in stock",
  out_of_stock: "Out of stock",
  price_increased: "Price increased",
  cart_reminder: "Cart reminder",
  checkout_incomplete: "Checkout incomplete",
  weekly_review: "Weekly review",
};

export function notificationTypeLabel(type: string): string {
  return NOTIFICATION_TYPE_LABELS[type] ?? type;
}

/** One notification row as the table renders it. */
export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  userId: string;
  userEmail: string | null;
  productId: string | null;
  productTitle: string | null;
  createdAt: string;
}

export interface NotificationStats {
  total: number;
  generated7d: number;
  generated30d: number;
  generatedToday: number;
  /** Signed delta of last-7d vs the prior 7d (up is good — more reach). */
  delta7d: ReturnType<typeof delta>;
  read: number;
  unread: number;
  /** Read share as 0–100 (of all notifications). */
  readRate: number;
  /** Per-type counts (all time), highest first. */
  byType: NamedValue[];
  /** Per-day generated counts for the last 30 days. */
  generatedTrend: ChartPoint[];
  /** True when there's no real Notification data and trends are demo fallbacks. */
  isDemo: boolean;
}

const SORTABLE: Record<string, string> = {
  createdAt: "createdAt",
  type: "type",
  read: "read",
};

function isType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

/**
 * Server-driven list of recent notifications. Reads `q` (matches title/body/
 * type) and the `type` / `read` filters, then applies sort + page. Joins the
 * recipient email and (when productId is set) the product title for display.
 */
export async function getNotifications(
  lp: ListParams,
): Promise<{ rows: NotificationView[]; total: number }> {
  if (!hasDatabase()) return { rows: [], total: 0 };
  try {
    const type = lp.params.type;
    const readParam = lp.params.read;

    const where: Record<string, unknown> = {};
    if (type && isType(type)) where.type = type;
    if (readParam === "read") where.read = true;
    else if (readParam === "unread") where.read = false;
    if (lp.q) {
      where.OR = [
        { title: { contains: lp.q, mode: "insensitive" } },
        { body: { contains: lp.q, mode: "insensitive" } },
        { type: { contains: lp.q, mode: "insensitive" } },
      ];
    }

    const sortKey = lp.sort ? SORTABLE[lp.sort.key] : undefined;
    const orderBy = sortKey
      ? { [sortKey]: lp.sort!.dir }
      : { createdAt: "desc" as const };

    const [rows, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy,
        skip: (lp.page - 1) * lp.pageSize,
        take: lp.pageSize,
        select: {
          id: true,
          type: true,
          title: true,
          body: true,
          read: true,
          userId: true,
          productId: true,
          createdAt: true,
          user: { select: { email: true } },
        },
      }),
      prisma.notification.count({ where }),
    ]);

    // Notification has no Product relation; resolve titles for the linked
    // products in this page in a single follow-up query (never fabricated).
    const productIds = [
      ...new Set(rows.map((r) => r.productId).filter((id): id is string => !!id)),
    ];
    const productTitles = new Map<string, string>();
    if (productIds.length > 0) {
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, title: true },
      });
      for (const p of products) productTitles.set(p.id, p.title);
    }

    return {
      rows: rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        read: r.read,
        userId: r.userId,
        userEmail: r.user?.email ?? null,
        productId: r.productId,
        productTitle: r.productId ? (productTitles.get(r.productId) ?? null) : null,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
    };
  } catch (e) {
    console.error("[ops] getNotifications failed:", e);
    return { rows: [], total: 0 };
  }
}

/**
 * Headline stats for the metric cards + the by-type and generated-over-time
 * charts. Pulls the last 30 days of notifications once for the windowed counts
 * and trend, plus the all-time totals for read/unread and per-type. Falls back
 * to a clearly-labelled demo state when there's no real data.
 */
export async function getNotificationStats(): Promise<NotificationStats> {
  const empty: NotificationStats = {
    total: 0,
    generated7d: 0,
    generated30d: 0,
    generatedToday: 0,
    delta7d: delta(0, 0, true),
    read: 0,
    unread: 0,
    readRate: 0,
    byType: [],
    generatedTrend: [],
    isDemo: true,
  };
  if (!hasDatabase()) return empty;
  try {
    const now = Date.now();
    const since = new Date(now - 30 * DAY_MS);

    const [total, read, grouped, recent, prior7dCount] = await Promise.all([
      prisma.notification.count(),
      prisma.notification.count({ where: { read: true } }),
      prisma.notification.groupBy({
        by: ["type"],
        _count: { _all: true },
      }),
      prisma.notification.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      // Prior 7-day window (days 8–14 back) for the reach delta.
      prisma.notification.count({
        where: {
          createdAt: {
            gte: new Date(now - 14 * DAY_MS),
            lt: new Date(now - 7 * DAY_MS),
          },
        },
      }),
    ]);

    if (total === 0) return empty;

    const dates = recent.map((r) => r.createdAt);
    const wc = windowCounts(dates, now);

    const byType: NamedValue[] = topBy(
      grouped,
      (g) => g.type,
      (g) => g._count._all,
      NOTIFICATION_TYPES.length,
    ).map((nv) => ({ ...nv, name: notificationTypeLabel(nv.name) }));

    const generatedTrend = bucketByDay(dates, 30, now);

    return {
      total,
      generated7d: wc.d7,
      generated30d: wc.d30,
      generatedToday: wc.today,
      delta7d: delta(wc.d7, prior7dCount, true),
      read,
      unread: total - read,
      readRate: total > 0 ? Math.round((read / total) * 1000) / 10 : 0,
      byType,
      generatedTrend,
      isDemo: false,
    };
  } catch (e) {
    console.error("[ops] getNotificationStats failed:", e);
    return empty;
  }
}
