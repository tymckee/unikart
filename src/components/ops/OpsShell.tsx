"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Wordmark } from "@/components/brand/WheelLogo";
import { Pill } from "@/components/ui/Pill";
import { OpsSidebar } from "./OpsSidebar";
import { OpsTopbar, type OpsViewerSummary } from "./OpsTopbar";
import { OpsToastProvider } from "./OpsToast";
import type { OpsNavLink } from "@/lib/ops/nav";

function BrandRow() {
  return (
    <Link href="/ops" className="flex items-center gap-2 px-2">
      <Wordmark size={24} />
      <Pill tone="ink" size="sm">
        Ops
      </Pill>
    </Link>
  );
}

/**
 * The Ops Console frame: a calm left sidebar (desktop), a slide-in drawer
 * (mobile), the top bar with operator identity, and the toast host. The nav is
 * pre-filtered by permission upstream in the console layout.
 */
export function OpsShell({
  viewer,
  navItems,
  env,
  children,
}: {
  viewer: OpsViewerSummary;
  navItems: OpsNavLink[];
  env: { label: string; isProd: boolean };
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <OpsToastProvider>
      <div className="flex min-h-dvh bg-canvas">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-porcelain px-3 py-4 lg:flex">
          <div className="mb-6 pt-1">
            <BrandRow />
          </div>
          <div className="flex-1 overflow-y-auto px-1 no-scrollbar">
            <OpsSidebar items={navItems} />
          </div>
          <footer className="px-3 pt-4 text-[0.6875rem] text-silver">
            Internal tooling · {env.label}
          </footer>
        </aside>

        {/* Mobile drawer */}
        <AnimatePresence>
          {drawerOpen && (
            <div className="fixed inset-0 z-50 lg:hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDrawerOpen(false)}
                className="absolute inset-0 bg-ink/20 backdrop-blur-sm"
                aria-hidden="true"
              />
              <motion.aside
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-y-0 left-0 flex w-72 flex-col bg-porcelain px-3 py-4 shadow-float"
              >
                <div className="mb-6 flex items-center justify-between pt-1">
                  <BrandRow />
                  <button
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close menu"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate hover:bg-canvas hover:text-ink"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-1">
                  <OpsSidebar items={navItems} onNavigate={() => setDrawerOpen(false)} />
                </div>
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <OpsTopbar viewer={viewer} env={env} onOpenMenu={() => setDrawerOpen(true)} />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </OpsToastProvider>
  );
}
