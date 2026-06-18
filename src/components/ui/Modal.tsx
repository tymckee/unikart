"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  description?: string;
  className?: string;
  hideClose?: boolean;
}

/** Centered glass dialog (sheet on mobile) with backdrop blur + Esc. */
export function Modal({
  open,
  onClose,
  children,
  title,
  description,
  className,
  hideClose = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    // Remember what had focus so we can restore it when the dialog closes.
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Focus trap: keep Tab / Shift+Tab cycling inside the dialog.
      if (e.key === "Tab") {
        const panel = panelRef.current;
        if (!panel) return;
        const items = Array.from(
          panel.querySelectorAll<HTMLElement>(FOCUSABLE),
        );
        if (items.length === 0) {
          e.preventDefault();
          panel.focus();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || !panel.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move focus into the dialog (first focusable, else the panel itself).
    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (firstFocusable ?? panel)?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      // Restore focus to wherever it was before the dialog opened.
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/20 backdrop-blur-md"
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={title ?? "Dialog"}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: reduceMotion ? 0.15 : 0.32, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "outline-none",
              "glass-strong relative z-10 max-h-[92vh] w-full overflow-y-auto rounded-t-3xl sm:m-4 sm:max-w-lg sm:rounded-3xl",
              className,
            )}
          >
            {(title || !hideClose) && (
              <div className="flex items-start justify-between gap-4 px-6 pt-6">
                <div>
                  {title && (
                    <h2 className="text-lg font-semibold tracking-tight text-ink">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="mt-1 text-sm text-slate">{description}</p>
                  )}
                </div>
                {!hideClose && (
                  <button
                    onClick={onClose}
                    aria-label="Close"
                    className="-mr-1 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate transition-colors hover:bg-canvas hover:text-ink"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
