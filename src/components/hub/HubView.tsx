"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  Eye,
  PackageSearch,
  ShoppingBag,
} from "lucide-react";
import { cn, formatPrice, priceDelta } from "@/lib/utils";
import type { ProductView } from "@/lib/types";
import { useHub } from "@/components/hub/HubProvider";
import { ProductGrid } from "@/components/product/ProductGrid";
import { CommandPasteBar } from "@/components/product/CommandPasteBar";
import { ManualAddButton } from "@/components/product/ManualAddButton";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";

type Filter =
  | "all"
  | "watching"
  | "drops"
  | "back"
  | "out"
  | "cart"
  | "purchased"
  | "released";

export function HubView({
  initial,
  backInStockIds,
  cartTotal,
  collections = [],
}: {
  initial: ProductView[];
  backInStockIds: string[];
  cartTotal: number;
  collections?: { id: string; name: string }[];
}) {
  const hub = useHub();
  const [filter, setFilter] = useState<Filter>("all");

  const products = useMemo(
    () => [...(hub?.added ?? []), ...initial],
    [hub?.added, initial],
  );

  const backSet = useMemo(() => new Set(backInStockIds), [backInStockIds]);

  const matches = useMemo(() => {
    const isDrop = (p: ProductView) => {
      const d = priceDelta(p.currentPrice, p.previousPrice);
      return d?.direction === "down";
    };
    // Releasing something is a conscious "let it go" — it leaves the active Hub
    // entirely (like archive/purchase) and lives only under its own filter.
    const active = (p: ProductView) =>
      !p.isArchived && !p.isPurchased && !p.releasedAt;
    return {
      all: active,
      watching: (p: ProductView) => active(p) && Boolean(p.alert?.enabled),
      drops: (p: ProductView) => active(p) && isDrop(p),
      back: (p: ProductView) => active(p) && backSet.has(p.id),
      out: (p: ProductView) =>
        active(p) && p.availability === "out_of_stock",
      cart: (p: ProductView) => active(p) && p.inCart,
      purchased: (p: ProductView) => p.isPurchased,
      released: (p: ProductView) => Boolean(p.releasedAt),
    } satisfies Record<Filter, (p: ProductView) => boolean>;
  }, [backSet]);

  const counts = useMemo(() => {
    const c = {} as Record<Filter, number>;
    (Object.keys(matches) as Filter[]).forEach((k) => {
      c[k] = products.filter(matches[k]).length;
    });
    return c;
  }, [products, matches]);

  const filtered = products.filter(matches[filter]);

  const dropCount = counts.drops;
  const watchingCount = counts.watching;

  const options = [
    { value: "all" as const, label: "All", count: counts.all },
    { value: "watching" as const, label: "Watching", count: counts.watching },
    { value: "drops" as const, label: "Price drops", count: counts.drops },
    { value: "back" as const, label: "Back in stock", count: counts.back },
    { value: "out" as const, label: "Out of stock", count: counts.out },
    { value: "cart" as const, label: "In cart", count: counts.cart },
    { value: "purchased" as const, label: "Purchased", count: counts.purchased },
    // Only surface "Released" once you've let something go — keeps it quiet.
    ...(counts.released > 0
      ? [{ value: "released" as const, label: "Released", count: counts.released }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your Hub"
        title="Everything you're watching"
        subtitle="Paste a link to save anything from across the web. We'll track price and stock so you know exactly when to buy."
        action={<ManualAddButton collections={collections} />}
      />

      {/* Prominent paste bar (mobile — desktop has it in the top bar) */}
      <div className="md:hidden">
        <CommandPasteBar collections={collections} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={<PackageSearch size={16} />}
          label="Tracking"
          value={String(counts.all)}
        />
        <Stat
          icon={<ArrowDownRight size={16} />}
          label="Price drops"
          value={String(dropCount)}
          tone="down"
        />
        <Stat
          icon={<Eye size={16} />}
          label="Watching"
          value={String(watchingCount)}
        />
        <Stat
          icon={<ShoppingBag size={16} />}
          label="Cart total"
          value={formatPrice(cartTotal, "USD", { compact: true })}
          tone="accent"
        />
      </div>

      {/* Filters */}
      <SegmentedControl
        scroll
        options={options}
        value={filter}
        onChange={(v) => setFilter(v as Filter)}
        className="w-full"
      />

      {/* Grid */}
      <ProductGrid
        products={filtered}
        empty={<EmptyForFilter filter={filter} />}
      />
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: "neutral" | "down" | "accent";
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
      <div
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-lg",
          tone === "down"
            ? "bg-down-soft text-down"
            : tone === "accent"
              ? "bg-accent-soft text-accent-ink"
              : "bg-canvas text-slate",
        )}
      >
        {icon}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-ink">
        {value}
      </p>
      <p className="text-xs text-slate">{label}</p>
    </div>
  );
}

function EmptyForFilter({ filter }: { filter: Filter }) {
  const copy: Record<Filter, { title: string; description: string }> = {
    all: {
      title: "Your Hub is calm and empty",
      description:
        "Paste a product link above to save your first item. We'll track its price and stock for you.",
    },
    watching: {
      title: "Nothing being watched yet",
      description:
        "Turn on a price alert from any product to keep an eye on it here.",
    },
    drops: {
      title: "No price drops right now",
      description: "When something you saved gets cheaper, it'll appear here.",
    },
    back: {
      title: "Nothing back in stock",
      description:
        "We'll surface items that return to stock so you don't miss them.",
    },
    out: {
      title: "Nothing out of stock",
      description: "Good news — everything you're tracking is available.",
    },
    cart: {
      title: "Your Universal Cart is empty",
      description: "Add products to your cart to check out across stores in one calm flow.",
    },
    purchased: {
      title: "No purchases yet",
      description: "Items you mark as purchased will be archived here.",
    },
    released: {
      title: "Nothing released yet",
      description:
        "When you let go of something you were considering, it rests here — no pressure to come back.",
    },
  };
  const c = copy[filter];
  return <EmptyState title={c.title} description={c.description} />;
}
