"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Settings as SettingsIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSignOut } from "@/components/auth/use-sign-out";

/**
 * The signed-in avatar in the top bar, with a quiet dropdown: who you are,
 * a link to Settings, and a real Sign out. Closes on outside click / Escape.
 */
export function AvatarMenu({
  name,
  email,
  image,
}: {
  name: string;
  email: string;
  image?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { signOut, pending } = useSignOut();

  const initial = (name || email || "?").trim().charAt(0).toUpperCase();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-ink text-sm font-semibold text-white transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="glass-strong absolute right-0 top-12 z-50 w-60 overflow-hidden rounded-2xl p-1.5"
          >
            <div className="px-3 py-2.5">
              <p className="truncate text-sm font-medium text-ink">{name}</p>
              <p className="truncate text-xs text-slate">{email}</p>
            </div>
            <div className="my-1 h-px bg-line" />
            <Link
              href="/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-ink transition-colors hover:bg-canvas"
            >
              <SettingsIcon size={16} className="text-slate" />
              Settings
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              disabled={pending}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-canvas",
                pending && "opacity-60",
              )}
            >
              <LogOut size={16} className="text-slate" />
              {pending ? "Signing out…" : "Sign out"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
