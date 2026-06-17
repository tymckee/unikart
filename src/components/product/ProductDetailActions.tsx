"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Check,
  CheckCircle2,
  ExternalLink,
  ShoppingBag,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { ProductView } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Input";

/**
 * Interactive controls on the product detail page. Phase 1 keeps state
 * local; Phase 2 wires these to server actions + Prisma.
 */
export function ProductDetailActions({ product }: { product: ProductView }) {
  const router = useRouter();
  const [inCart, setInCart] = useState(product.inCart);
  const [watching, setWatching] = useState(Boolean(product.alert?.enabled));
  const [target, setTarget] = useState(
    product.alert?.targetPrice ? String(product.alert.targetPrice) : "",
  );
  const [notes, setNotes] = useState(product.notes ?? "");
  const [purchased, setPurchased] = useState(product.isPurchased);

  return (
    <div className="space-y-5">
      {/* Primary actions */}
      <GlassCard variant="solid" className="space-y-2.5 p-5">
        <Button
          className="w-full"
          variant={inCart ? "secondary" : "primary"}
          onClick={() => setInCart((v) => !v)}
        >
          {inCart ? <Check size={17} /> : <ShoppingBag size={17} />}
          {inCart ? "In your Universal Cart" : "Add to Universal Cart"}
        </Button>
        <Button
          className="w-full"
          variant="secondary"
          href={product.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open product page <ExternalLink size={15} />
        </Button>
        <div className="flex gap-2.5 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => setPurchased((v) => !v)}
          >
            <CheckCircle2 size={15} />
            {purchased ? "Purchased" : "Mark purchased"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() => router.push("/dashboard")}
          >
            <Archive size={15} />
            Archive
          </Button>
        </div>
      </GlassCard>

      {/* Target alert */}
      <GlassCard variant="solid" className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">Price alert</h3>
            <p className="mt-0.5 text-xs text-slate">
              Get notified on drops & restocks.
            </p>
          </div>
          <Switch
            checked={watching}
            onCheckedChange={setWatching}
            label="Toggle price alert"
          />
        </div>
        {watching && (
          <div className="mt-4 space-y-2">
            <label className="text-xs font-medium text-slate">
              Target price
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 shadow-soft">
              <span className="text-sm text-slate">$</span>
              <input
                value={target}
                onChange={(e) =>
                  setTarget(e.target.value.replace(/[^0-9.]/g, ""))
                }
                inputMode="decimal"
                placeholder={
                  product.currentPrice
                    ? String(Math.floor(product.currentPrice * 0.9))
                    : "0"
                }
                className="h-11 flex-1 bg-transparent text-sm text-ink placeholder:text-silver focus:outline-none"
              />
            </div>
            {target && product.currentPrice != null && (
              <p className="text-xs text-slate">
                We&apos;ll alert you when it reaches{" "}
                <span className="font-medium text-ink">
                  {formatPrice(Number(target), product.currency)}
                </span>{" "}
                — that&apos;s{" "}
                {formatPrice(
                  Math.max(0, product.currentPrice - Number(target)),
                  product.currency,
                )}{" "}
                below today.
              </p>
            )}
          </div>
        )}
      </GlassCard>

      {/* Notes */}
      <GlassCard variant="solid" className="p-5">
        <h3 className="mb-2.5 text-sm font-semibold text-ink">Notes</h3>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Size, color, who it's for, why you're waiting…"
        />
      </GlassCard>
    </div>
  );
}
