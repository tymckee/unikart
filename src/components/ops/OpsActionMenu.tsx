"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OpsActionItem {
  label: string;
  onSelect: () => void;
  icon?: React.ReactNode;
  /** Destructive styling (quiet red). */
  danger?: boolean;
  /** Hide the item entirely (e.g. role not permitted). */
  hidden?: boolean;
  disabled?: boolean;
}

/**
 * Kebab dropdown of row/page actions. Items the role can't perform should be
 * omitted by the caller (server already enforces, this just hides UI).
 */
export function OpsActionMenu({
  items,
  label = "Actions",
  align = "right",
}: {
  items: OpsActionItem[];
  label?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const visible = items.filter((i) => !i.hidden);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (visible.length === 0) return null;

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate transition-colors hover:bg-canvas hover:text-ink"
      >
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div
          role="menu"
          className={cn(
            "surface absolute z-30 mt-1 min-w-[12rem] overflow-hidden rounded-xl p-1",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {visible.map((item, i) => (
            <button
              key={i}
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors disabled:opacity-40",
                item.danger
                  ? "text-up hover:bg-up-soft"
                  : "text-ink hover:bg-canvas",
              )}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
