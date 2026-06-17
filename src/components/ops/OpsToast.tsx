"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "info";
interface Toast {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastApi {
  show: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi>({
  show: () => {},
  success: () => {},
  error: () => {},
});

export function useOpsToast(): ToastApi {
  return useContext(ToastContext);
}

let counter = 0;

const ICONS = {
  success: <CheckCircle2 size={16} className="text-down" />,
  error: <AlertTriangle size={16} className="text-up" />,
  info: <Info size={16} className="text-accent" />,
} as const;

/** Calm, non-intrusive toasts (bottom-right). Mounted once in OpsShell. */
export function OpsToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (message: string, tone: ToastTone = "info") => {
      const id = ++counter;
      setToasts((t) => [...t, { id, tone, message }]);
      setTimeout(() => remove(id), 4200);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (m) => show(m, "success"),
      error: (m) => show(m, "error"),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "glass-strong pointer-events-auto flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm text-ink shadow-lift",
              )}
              role="status"
            >
              <span className="mt-0.5 shrink-0">{ICONS[t.tone]}</span>
              <span className="text-pretty">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
