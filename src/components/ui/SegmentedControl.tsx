"use client";

import { motion } from "framer-motion";
import { useId } from "react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
  /** Scrollable single row (for long filter sets on mobile). */
  scroll?: boolean;
}

/** iOS-style segmented control with a sliding indicator. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  className,
  scroll = false,
}: SegmentedControlProps<T>) {
  const groupId = useId();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-line bg-canvas/80 p-1 backdrop-blur",
        scroll && "max-w-full overflow-x-auto no-scrollbar",
        className,
      )}
      role="tablist"
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative shrink-0 rounded-full font-medium transition-colors duration-200",
              size === "sm" ? "px-3 py-1 text-[0.75rem]" : "px-3.5 py-1.5 text-[0.8125rem]",
              active ? "text-ink" : "text-slate hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${groupId}`}
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
                className="absolute inset-0 rounded-full bg-white shadow-soft"
              />
            )}
            <span className="relative z-10 inline-flex items-center gap-1.5">
              {opt.label}
              {opt.count != null && (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[0.625rem] tabular-nums",
                    active ? "bg-canvas text-slate" : "bg-white/70 text-silver",
                  )}
                >
                  {opt.count}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
