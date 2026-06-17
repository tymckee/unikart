"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, Menu, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Pill } from "@/components/ui/Pill";
import { useSignOut } from "@/components/auth/use-sign-out";
import { ROLE_META, type Role } from "@/lib/ops/permissions";

export interface OpsViewerSummary {
  name: string;
  email: string;
  image: string | null;
  role: Role;
  viaAllowlist: boolean;
}

/** Top bar: mobile menu trigger, environment badge, operator identity + sign-out. */
export function OpsTopbar({
  viewer,
  env,
  onOpenMenu,
}: {
  viewer: OpsViewerSummary;
  env: { label: string; isProd: boolean };
  onOpenMenu: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { signOut, pending } = useSignOut("/ops/sign-in");

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const initial = (viewer.name || viewer.email || "?").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-line">
      <div className="glass-strong">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Open menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate transition-colors hover:bg-canvas hover:text-ink lg:hidden"
          >
            <Menu size={18} />
          </button>

          <div className="flex-1" />

          <Pill tone={env.isProd ? "warn" : "neutral"} dot>
            {env.label}
          </Pill>

          <div className="relative" ref={ref}>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={open}
              className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-canvas"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white">
                {initial}
              </span>
              <span className="hidden text-sm font-medium text-ink sm:block">
                {viewer.name || viewer.email}
              </span>
              <ChevronDown size={15} className="text-silver" />
            </button>

            {open && (
              <div
                role="menu"
                className="surface absolute right-0 z-40 mt-1.5 w-64 overflow-hidden rounded-2xl p-1.5"
              >
                <div className="px-3 py-2.5">
                  <p className="truncate text-sm font-medium text-ink">{viewer.name}</p>
                  <p className="truncate text-xs text-slate">{viewer.email}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Pill tone="accent" icon={<ShieldCheck size={11} />}>
                      {ROLE_META[viewer.role]?.label ?? viewer.role}
                    </Pill>
                    {viewer.viaAllowlist && <Pill tone="outline">allowlist</Pill>}
                  </div>
                </div>
                <div className="my-1 h-px bg-line" />
                <Link
                  href="/ops/settings"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-canvas"
                >
                  Settings
                </Link>
                <Link
                  href="/dashboard"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm text-ink transition-colors hover:bg-canvas"
                >
                  Open UniKart app
                </Link>
                <button
                  role="menuitem"
                  onClick={signOut}
                  disabled={pending}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-canvas disabled:opacity-50",
                  )}
                >
                  <LogOut size={15} className="text-slate" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
