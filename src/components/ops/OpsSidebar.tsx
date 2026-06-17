"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  CreditCard,
  Flag,
  Gauge,
  LifeBuoy,
  ListChecks,
  Package,
  ScanLine,
  ScrollText,
  Server,
  Settings,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { OpsNavLink } from "@/lib/ops/nav";

const ICONS: Record<string, LucideIcon> = {
  gauge: Gauge,
  users: Users,
  package: Package,
  scan: ScanLine,
  listChecks: ListChecks,
  activity: Activity,
  wallet: Wallet,
  lifeBuoy: LifeBuoy,
  bell: Bell,
  creditCard: CreditCard,
  flag: Flag,
  server: Server,
  scroll: ScrollText,
  settings: Settings,
};

/** Left navigation for the Ops Console (desktop) — permission-filtered upstream. */
export function OpsSidebar({
  items,
  onNavigate,
}: {
  items: OpsNavLink[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = (item: OpsNavLink) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Ops sections">
      {items.map((item) => {
        const Icon = ICONS[item.iconKey] ?? Gauge;
        const active = isActive(item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-white text-ink shadow-soft"
                : "text-slate hover:bg-white/60 hover:text-ink",
            )}
          >
            <Icon
              size={17}
              strokeWidth={active ? 2.2 : 1.8}
              className={cn(active ? "text-accent" : "text-silver group-hover:text-slate")}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
