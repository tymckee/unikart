import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { HubView } from "@/components/hub/HubView";
import {
  getCartView,
  getCollectionsWithCounts,
  getProductViews,
  mockNotifications,
} from "@/lib/mock-data";

export const metadata: Metadata = { title: "Demo" };

/**
 * Public demo. Reads straight from the in-memory mock selectors (seeded user_1
 * data) rather than the session-scoped data layer, so it renders the same rich
 * sample Hub for everyone — no account, no database required.
 */
export default function DemoPage() {
  const products = getProductViews();
  const cart = getCartView();
  const collections = getCollectionsWithCounts();
  const backInStockIds = mockNotifications
    .filter((n) => n.type === "back_in_stock" && n.productId)
    .map((n) => n.productId as string);

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
