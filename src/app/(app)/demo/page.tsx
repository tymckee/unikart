import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { HubView } from "@/components/hub/HubView";
import {
  getBackInStockIds,
  getCartView,
  getCollectionsWithCounts,
  getProductViews,
} from "@/lib/data";

export const metadata: Metadata = { title: "Demo" };
export const dynamic = "force-dynamic";

export default async function DemoPage() {
  const [products, cart, backInStockIds, collections] = await Promise.all([
    getProductViews(),
    getCartView(),
    getBackInStockIds(),
    getCollectionsWithCounts(),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5 rounded-2xl border border-accent/20 bg-accent-soft/40 px-4 py-3 text-sm text-accent-ink">
        <Sparkles size={16} />
        <span>
          You&apos;re exploring UniKart with sample data. Paste a real link any
          time to save your own.
        </span>
      </div>
      <HubView
        initial={products}
        backInStockIds={backInStockIds}
        cartTotal={cart.total}
        collections={collections.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
