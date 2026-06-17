"use client";

import { motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { WheelLogo } from "@/components/brand/WheelLogo";
import { GlassCard } from "@/components/ui/GlassCard";

/**
 * A quiet welcome moment shown once after returning from Stripe Checkout
 * (?upgraded=1). Calm by design — a single serene line, the subtle wheel mark,
 * a soft fade-in, and an unobtrusive way to dismiss. No confetti, no urgency,
 * no exclamation marks.
 */
export function ProWelcome({ onDismiss }: { onDismiss: () => void }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassCard
        as="section"
        variant="glass"
        className="relative flex items-start gap-4 p-5"
        aria-label="Welcome to UniKart Coast"
      >
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-ink">
          <WheelLogo size={22} accentHub title="UniKart Coast" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-ink">
            Welcome to UniKart Coast
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate">
            Everything you save is now watched for you. Take your time — we&apos;ll
            let you know when prices move.
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-silver transition-colors hover:bg-canvas hover:text-slate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <X size={16} />
        </button>
      </GlassCard>
    </motion.div>
  );
}
