"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  ExternalLink,
  Info,
  ShieldCheck,
  Store,
} from "lucide-react";
import { cn, formatPrice, prettyDomain } from "@/lib/utils";
import type { ProductView, UniversalCartItem } from "@/lib/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { WheelRing } from "@/components/brand/WheelRing";
import { ProductTile } from "@/components/product/ProductTile";

interface Row {
  item: UniversalCartItem;
  product: ProductView;
}
type StepState = "pending" | "opened" | "completed";

export function CheckoutAssistant({ initial }: { initial: Row[] }) {
  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of initial) {
      const key = r.product.storeDomain;
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()].map(([domain, list]) => ({
      domain,
      storeName: list[0].product.storeName,
      url: list[0].product.originalUrl,
      rows: list,
      subtotal: list.reduce(
        (s, r) => s + (r.product.currentPrice ?? 0) * r.item.quantity,
        0,
      ),
    }));
  }, [initial]);

  const [verify, setVerify] = useState<"idle" | "verifying" | "verified">(
    "idle",
  );
  const [status, setStatus] = useState<Record<string, StepState>>(() =>
    Object.fromEntries(groups.map((g) => [g.domain, "pending" as StepState])),
  );

  const total = groups.length;
  const completed = groups.filter((g) => status[g.domain] === "completed").length;
  const progress = total ? completed / total : 0;
  const allDone = total > 0 && completed === total;
  const itemCount = initial.length;

  const open = (domain: string, url: string) => {
    window.open(url, "_blank", "noopener");
    setStatus((s) => ({ ...s, [domain]: "opened" }));
  };
  const complete = (domain: string) =>
    setStatus((s) => ({ ...s, [domain]: "completed" }));
  const reopen = (domain: string) =>
    setStatus((s) => ({ ...s, [domain]: "opened" }));

  return (
    <div className="space-y-6">
      {/* Progress header */}
      <GlassCard variant="solid" className="flex items-center gap-5 p-6">
        <WheelRing progress={progress} size={88} stroke={8} ticks={total}>
          <span className="text-base font-semibold tabular-nums text-ink">
            {completed}/{total}
          </span>
        </WheelRing>
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            {allDone ? "Checkout complete" : "Guided checkout"}
          </h2>
          <p className="mt-0.5 text-sm text-slate">
            {allDone
              ? `${itemCount} items moved to your Purchased archive.`
              : `${total} stores · ${itemCount} items. We'll guide you through each one.`}
          </p>
        </div>
      </GlassCard>

      <AnimatePresence>
        {allDone && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-4 rounded-2xl border border-down/20 bg-down-soft/40 px-6 py-10 text-center"
          >
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white text-down shadow-soft">
              <CheckCircle2 size={30} />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-ink">Nicely done</h3>
              <p className="mt-1 text-sm text-slate">
                Everything you set out to buy is handled. Calm and complete.
              </p>
            </div>
            <div className="flex gap-3">
              <Button href="/dashboard" variant="secondary">
                Back to Hub
              </Button>
              <Button href="/dashboard">View purchased</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!allDone && (
        <>
          {/* Step 1 — verify */}
          <GlassCard variant="solid" className="p-5">
            <div className="flex items-start gap-4">
              <StepNumber done={verify === "verified"} n={1} />
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-ink">
                  Verify latest price & stock
                </h3>
                <p className="mt-0.5 text-sm text-slate">
                  A quick check before you buy, so there are no surprises.
                </p>

                {verify === "verified" ? (
                  <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-down-soft px-3 py-2 text-sm text-down">
                    <ShieldCheck size={16} />
                    Confirmed {itemCount} items across {total} stores — nothing
                    changed since you saved.
                  </div>
                ) : (
                  <Button
                    className="mt-3"
                    size="sm"
                    onClick={() => {
                      setVerify("verifying");
                      setTimeout(() => setVerify("verified"), 1400);
                    }}
                    loading={verify === "verifying"}
                  >
                    {verify === "verifying" ? (
                      "Checking…"
                    ) : (
                      <>
                        <ShieldCheck size={15} /> Verify now
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </GlassCard>

          {/* Merchant steps */}
          {groups.map((g, i) => {
            const st = status[g.domain];
            const locked = verify !== "verified";
            return (
              <GlassCard
                key={g.domain}
                variant="solid"
                className={cn(
                  "p-5 transition-opacity",
                  st === "completed" && "opacity-70",
                )}
              >
                <div className="flex items-start gap-4">
                  <StepNumber done={st === "completed"} n={i + 2} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-canvas text-slate">
                          <Store size={16} />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">
                            {g.storeName}
                          </p>
                          <p className="text-xs text-slate">
                            {prettyDomain(g.domain)} ·{" "}
                            {formatPrice(g.subtotal, "USD")}
                          </p>
                        </div>
                      </div>
                      {st === "completed" ? (
                        <Pill tone="down" icon={<Check size={11} />}>
                          Done
                        </Pill>
                      ) : st === "opened" ? (
                        <Pill tone="accent" dot>
                          Opened
                        </Pill>
                      ) : (
                        <Pill tone="outline">{g.rows.length} items</Pill>
                      )}
                    </div>

                    {/* item thumbnails */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {g.rows.map(({ item, product }) => (
                        <ProductTile
                          key={item.id}
                          category={product.category}
                          imageUrl={product.imageUrl}
                          title={product.title}
                          className="h-12 w-12 rounded-lg"
                          iconSize={20}
                          watermark={false}
                        />
                      ))}
                    </div>

                    {/* actions */}
                    {st !== "completed" && (
                      <div className="mt-4 flex flex-wrap gap-2.5">
                        <Button
                          size="sm"
                          variant={st === "opened" ? "secondary" : "primary"}
                          disabled={locked}
                          onClick={() => open(g.domain, g.url)}
                        >
                          {st === "opened" ? "Reopen" : `Open ${g.storeName}`}
                          <ExternalLink size={14} />
                        </Button>
                        {st === "opened" && (
                          <Button
                            size="sm"
                            onClick={() => complete(g.domain)}
                          >
                            <Check size={15} /> Mark complete
                          </Button>
                        )}
                        {locked && (
                          <span className="inline-flex items-center text-xs text-silver">
                            Verify prices first
                          </span>
                        )}
                      </div>
                    )}
                    {st === "completed" && (
                      <button
                        onClick={() => reopen(g.domain)}
                        className="mt-3 text-xs text-slate hover:text-ink"
                      >
                        Undo
                      </button>
                    )}
                  </div>
                </div>
              </GlassCard>
            );
          })}

          <div className="flex items-start gap-2.5 rounded-xl bg-canvas px-4 py-3 text-xs text-slate">
            <Info size={15} className="mt-0.5 shrink-0 text-silver" />
            <span>
              Each checkout happens on the merchant&apos;s own secure site in a
              new tab. UniKart never sees or stores your payment details. Mark a
              store complete once you&apos;ve finished its checkout.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function StepNumber({ n, done }: { n: number; done: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
        done ? "bg-down text-white" : "bg-ink text-white",
      )}
    >
      {done ? <Check size={14} /> : n}
    </span>
  );
}
