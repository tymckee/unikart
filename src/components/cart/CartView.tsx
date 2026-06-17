"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Info, Store, Trash2 } from "lucide-react";
import { formatPrice, prettyDomain } from "@/lib/utils";
import type { ProductView, UniversalCartItem } from "@/lib/types";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/EmptyState";
import { WheelRing } from "@/components/brand/WheelRing";
import { ProductTile } from "@/components/product/ProductTile";
import { StockBadge } from "@/components/product/StockBadge";
import { IntegrationStrip } from "./IntegrationStrip";

interface Row {
  item: UniversalCartItem;
  product: ProductView;
}

export function CartView({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initial);

  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of rows) {
      const key = r.product.storeDomain;
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return [...map.entries()].map(([domain, list]) => ({
      domain,
      storeName: list[0].product.storeName,
      rows: list,
      subtotal: list.reduce(
        (s, r) => s + (r.product.currentPrice ?? 0) * r.item.quantity,
        0,
      ),
    }));
  }, [rows]);

  const total = groups.reduce((s, g) => s + g.subtotal, 0);
  const itemCount = rows.reduce((s, r) => s + r.item.quantity, 0);
  const inStock = rows.filter(
    (r) => r.product.availability !== "out_of_stock",
  ).length;
  const readiness = rows.length ? inStock / rows.length : 0;

  const remove = (id: string) =>
    setRows((prev) => prev.filter((r) => r.item.id !== id));

  if (rows.length === 0) {
    return (
      <EmptyState
        title="Your Universal Cart is empty"
        description="Add products from your Hub to check out across multiple stores in one calm, guided flow."
        action={<Button href="/dashboard">Go to your Hub</Button>}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <GlassCard variant="solid" className="p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-5">
            <WheelRing progress={readiness} size={92} stroke={8} ticks={groups.length}>
              <span className="text-lg font-semibold tabular-nums text-ink">
                {groups.length}
              </span>
              <span className="text-[0.5625rem] uppercase tracking-wide text-silver">
                stores
              </span>
            </WheelRing>
            <div>
              <p className="text-sm text-slate">Estimated total</p>
              <p className="text-3xl font-semibold tracking-tight text-ink">
                {formatPrice(total, "USD")}
              </p>
              <p className="mt-0.5 text-xs text-slate">
                {itemCount} items · {inStock} of {rows.length} in stock
              </p>
            </div>
          </div>
          <Button href="/cart/checkout-assistant" size="lg" className="w-full sm:w-auto">
            Checkout Assistant <ArrowRight size={18} />
          </Button>
        </div>

        <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-canvas px-4 py-3 text-xs text-slate">
          <Info size={15} className="mt-0.5 shrink-0 text-silver" />
          <span>
            Prices and stock may have changed since you saved — the Checkout
            Assistant verifies them first. Checkout always happens on each
            merchant&apos;s own secure site. UniKart never handles your payment.
          </span>
        </div>
      </GlassCard>

      {/* Groups by merchant */}
      <div className="space-y-4">
        {groups.map((g) => (
          <GlassCard key={g.domain} variant="solid" className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-canvas text-slate">
                  <Store size={16} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">{g.storeName}</p>
                  <p className="text-xs text-slate">{prettyDomain(g.domain)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-ink">
                  {formatPrice(g.subtotal, "USD")}
                </p>
                <p className="text-xs text-slate">
                  {g.rows.length} {g.rows.length === 1 ? "item" : "items"}
                </p>
              </div>
            </div>

            <ul className="divide-y divide-line">
              {g.rows.map(({ item, product }) => (
                <li key={item.id} className="flex items-center gap-3.5 px-5 py-3.5">
                  <ProductTile
                    category={product.category}
                    imageUrl={product.imageUrl}
                    title={product.title}
                    className="h-14 w-14 shrink-0 rounded-xl"
                    iconSize={22}
                    watermark={false}
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/products/${product.id}`}
                      className="line-clamp-1 text-sm font-medium text-ink hover:text-accent"
                    >
                      {product.title}
                    </Link>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-sm text-ink">
                        {formatPrice(product.currentPrice, product.currency)}
                      </span>
                      <StockBadge availability={product.availability} />
                    </div>
                  </div>
                  <button
                    onClick={() => remove(item.id)}
                    aria-label="Remove from cart"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-silver transition-colors hover:bg-up-soft hover:text-up"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </GlassCard>
        ))}
      </div>

      <div>
        <p className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate">
          Future checkout partners
          <Pill tone="outline">Planned</Pill>
        </p>
        <IntegrationStrip />
      </div>
    </div>
  );
}
