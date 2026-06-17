"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
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
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
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
                    className="-mr-1 -mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate transition-colors hover:bg-canvas hover:text-ink"
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
