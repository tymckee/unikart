"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  House,
  LayoutGrid,
  Plus,
  Settings,
  ShoppingBag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Wordmark } from "@/components/brand/WheelLogo";
import { CommandPasteBar } from "@/components/product/CommandPasteBar";
import { Footer } from "./Footer";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Hub", icon: House },
  { href: "/collections", label: "Collections", icon: LayoutGrid },
  { href: "/cart", label: "Cart", icon: ShoppingBag },
  { href: "/notifications", label: "Alerts", icon: Bell },
];

export function AppShell({
  children,
  unread = 0,
}: {
  children: React.ReactNode;
  unread?: number;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Keyboard shortcut: Cmd/Ctrl+K focuses the paste bar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        const el = document.getElementById("unikart-paste");
        if (el) (el as HTMLInputElement).focus();
        else router.push("/dashboard");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-line">
        <div className="glass-strong">
          <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-5">
            <Link href="/dashboard" className="shrink-0">
              <Wordmark />
            </Link>

            {/* Desktop nav */}
            <nav className="ml-2 hidden items-center gap-1 lg:flex">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                    isActive(item.href)
                      ? "bg-canvas text-ink"
                      : "text-slate hover:text-ink",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="flex-1" />

            {/* Paste bar (desktop) */}
            <div className="hidden w-72 md:block xl:w-80">
              <CommandPasteBar />
            </div>

            {/* Notifications */}
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-slate transition-colors hover:bg-canvas hover:text-ink"
            >
              <Bell size={19} />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-up opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-up" />
                </span>
              )}
            </Link>

            {/* Profile */}
            <Link
              href="/settings"
              aria-label="Settings"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white transition-transform hover:scale-105"
            >
              T
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-5 md:pb-16">
        {children}
      </main>

      <div className="hidden md:block">
        <Footer />
      </div>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line md:hidden">
        <div className="glass-strong">
          <div className="mx-auto flex h-[4.25rem] max-w-md items-center justify-around px-2 pb-[env(safe-area-inset-bottom)]">
            <TabItem item={NAV[0]} active={isActive(NAV[0].href)} />
            <TabItem item={NAV[1]} active={isActive(NAV[1].href)} />
            <Link
              href="/dashboard"
              aria-label="Add a product"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white shadow-lift transition-transform active:scale-95"
            >
              <Plus size={22} />
            </Link>
            <TabItem item={NAV[2]} active={isActive(NAV[2].href)} />
            <TabItem
              item={{ href: "/settings", label: "You", icon: Settings }}
              active={isActive("/settings")}
            />
          </div>
        </div>
      </nav>
    </div>
  );
}

function TabItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex w-16 flex-col items-center gap-1 rounded-xl py-1.5 text-[0.625rem] font-medium transition-colors",
        active ? "text-ink" : "text-silver",
      )}
    >
      <Icon size={21} strokeWidth={active ? 2.2 : 1.8} />
      {item.label}
    </Link>
  );
}
