"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  Bell,
  Check,
  Clock,
  ExternalLink,
  Eye,
  ShoppingCart,
  Target,
  TrendingDown,
  TrendingUp,
  Wind,
} from "lucide-react";
import { cn, durationSince, formatPrice, priceDelta } from "@/lib/utils";
import type { ProductView } from "@/lib/types";
import {
  addToCart,
  archiveProduct,
  releaseProduct,
  removeProductFromCart,
  setAlert,
} from "@/lib/actions";
import { GlassCard } from "@/components/ui/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { ProductTile } from "./ProductTile";
import { StockBadge, ConfidenceMeter } from "./StockBadge";

export function ProductCard({ product }: { product: ProductView }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [watching, setWatching] = useState(Boolean(product.alert?.enabled));
  const [inCart, setInCart] = useState(product.inCart);
  // Set when the card leaves the active Hub (archived or released) — animates out.
  const [removed, setRemoved] = useState(false);

  const delta = priceDelta(product.currentPrice, product.previousPrice);
  const hasTarget = product.alert?.type === "target_price" && product.alert.targetPrice;

  // How long this has been waiting since you saved it. Computed in a mount
  // effect (not during render) so the relative time can't cause an SSR/CSR
  // hydration mismatch and render stays pure.
  const [considering, setConsidering] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsidering(durationSince(product.createdAt));
  }, [product.createdAt]);

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fn();
  };

  return (
    <AnimatePresence>
      {!removed && (
        <motion.div
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <GlassCard
            interactive
            variant="solid"
            className="group relative overflow-hidden"
          >
            <Link href={`/products/${product.id}`} className="block">
              {/* Artwork */}
              <div className="relative">
                <ProductTile
                  category={product.category}
                  imageUrl={product.cutoutUrl ?? product.imageUrl}
                  title={product.title}
                  storeName={product.storeName}
                  className="aspect-[4/3] w-full"
                />

                {/* Alert spoke (top-right) */}
                {watching && (
                  <span className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-accent shadow-soft backdrop-blur-sm">
                    {hasTarget ? <Target size={14} /> : <Bell size={14} />}
                  </span>
                )}

                {/* Quick actions — hover shortcuts on pointer devices. On
                    touch (phone/tablet) the overlay is omitted entirely; the
                    card taps through to the detail page, which has the same
                    actions — keeps the mobile Hub calm and uncluttered. */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden items-center justify-center gap-1.5 p-3 opacity-0 transition-all duration-300 [@media(hover:hover)]:flex group-hover:pointer-events-auto group-hover:opacity-100">
                  <QuickAction
                    label={watching ? "Watching" : "Watch"}
                    active={watching}
                    onClick={stop(() => {
                      const next = !watching;
                      setWatching(next);
                      run(() =>
                        setAlert(product.id, {
                          enabled: next,
                          targetPrice: product.alert?.targetPrice ?? null,
                        }),
                      );
                    })}
                  >
                    <Eye size={16} />
                  </QuickAction>
                  <QuickAction
                    label={inCart ? "In cart" : "Add to cart"}
                    active={inCart}
                    onClick={stop(() => {
                      const next = !inCart;
                      setInCart(next);
                      run(() =>
                        next
                          ? addToCart(product.id)
                          : removeProductFromCart(product.id),
                      );
                    })}
                  >
                    {inCart ? <Check size={16} /> : <ShoppingCart size={16} />}
                  </QuickAction>
                  <QuickAction
                    label="Open"
                    onClick={stop(() =>
                      window.open(product.originalUrl, "_blank", "noopener"),
                    )}
                  >
                    <ExternalLink size={16} />
                  </QuickAction>
                  <QuickAction
                    label="Release"
                    onClick={stop(() => {
                      setRemoved(true);
                      run(() => releaseProduct(product.id));
                    })}
                  >
                    <Wind size={16} />
                  </QuickAction>
                  <QuickAction
                    label="Archive"
                    onClick={stop(() => {
                      setRemoved(true);
                      run(() => archiveProduct(product.id));
                    })}
                  >
                    <Archive size={16} />
                  </QuickAction>
                </div>
              </div>

              {/* Body */}
              <div className="space-y-2.5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-[0.9375rem] font-semibold leading-snug text-ink">
                    {product.title}
                  </h3>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate">
                  <span className="min-w-0 truncate">{product.storeName}</span>
                  <span className="shrink-0 text-fog">·</span>
                  <ConfidenceMeter
                    className="shrink-0"
                    confidence={product.metadataConfidence}
                  />
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-2 pt-0.5">
                  <span className="text-lg font-semibold tracking-tight text-ink">
                    {formatPrice(product.currentPrice, product.currency)}
                  </span>
                  {delta && delta.direction !== "flat" && (
                    <>
                      <span className="text-xs text-silver line-through">
                        {formatPrice(product.previousPrice, product.currency)}
                      </span>
                      <Pill
                        tone={delta.direction === "down" ? "down" : "up"}
                        icon={
                          delta.direction === "down" ? (
                            <TrendingDown size={11} />
                          ) : (
                            <TrendingUp size={11} />
                          )
                        }
                      >
                        {delta.pct > 0 ? "+" : ""}
                        {delta.pct.toFixed(0)}%
                      </Pill>
                    </>
                  )}
                </div>

                {/* Badges */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <StockBadge availability={product.availability} />
                  {product.collections[0] && (
                    <Pill tone="outline">{product.collections[0].name}</Pill>
                  )}
                  {inCart && (
                    <Pill tone="accent" dot>
                      In cart
                    </Pill>
                  )}
                </div>

                {/* How long it's been waiting — quiet, intentional */}
                {considering && (
                  <p className="flex items-center gap-1 pt-0.5 text-xs text-silver">
                    <Clock size={11} className="shrink-0" />
                    <span>Considering for {considering}</span>
                  </p>
                )}
              </div>
            </Link>
          </GlassCard>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function QuickAction({
  children,
  label,
  active,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-line shadow-soft backdrop-blur-md transition-all duration-200 hover:scale-105 active:scale-95",
        active ? "bg-ink text-white" : "bg-white/85 text-ink hover:bg-white",
      )}
    >
      {children}
    </button>
  );
}
