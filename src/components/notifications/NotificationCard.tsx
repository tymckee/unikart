import Link from "next/link";
import {
  AlertCircle,
  PackageCheck,
  PackageX,
  ShoppingBag,
  Target,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn, timeAgo } from "@/lib/utils";
import { NOW } from "@/lib/mock-data";
import type { Notification, NotificationType } from "@/lib/types";

const META: Record<
  NotificationType,
  { icon: LucideIcon; bg: string; fg: string }
> = {
  price_dropped: { icon: TrendingDown, bg: "bg-down-soft", fg: "text-down" },
  target_reached: { icon: Target, bg: "bg-accent-soft", fg: "text-accent-ink" },
  back_in_stock: { icon: PackageCheck, bg: "bg-down-soft", fg: "text-down" },
  out_of_stock: { icon: PackageX, bg: "bg-up-soft", fg: "text-up" },
  price_increased: { icon: TrendingUp, bg: "bg-up-soft", fg: "text-up" },
  cart_reminder: { icon: ShoppingBag, bg: "bg-accent-soft", fg: "text-accent-ink" },
  checkout_incomplete: { icon: AlertCircle, bg: "bg-warn-soft", fg: "text-warn" },
};

export function NotificationCard({ notification: n }: { notification: Notification }) {
  const m = META[n.type];
  const Icon = m.icon;
  const href = n.productId
    ? `/products/${n.productId}`
    : n.cartId
      ? "/cart"
      : "#";

  return (
    <Link
      href={href}
      className={cn(
        "group flex items-start gap-3.5 rounded-2xl border p-4 transition-all duration-200 hover:shadow-soft",
        n.read ? "border-line bg-white" : "border-accent/20 bg-accent-soft/30",
      )}
    >
      <span
        className={cn(
          "mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          m.bg,
          m.fg,
        )}
      >
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold leading-snug text-ink">{n.title}</p>
          {!n.read && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
          )}
        </div>
        <p className="mt-0.5 text-pretty text-sm text-slate">{n.body}</p>
        <p className="mt-1.5 text-xs text-silver">{timeAgo(n.createdAt, NOW)}</p>
      </div>
    </Link>
  );
}
