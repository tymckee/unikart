import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { HubView } from "@/components/hub/HubView";
import {
  getCartView,
  getProductViews,
  mockNotifications,
} from "@/lib/mock-data";

export const metadata: Metadata = { title: "Demo" };

export default function DemoPage() {
  const products = getProductViews();
  const { total } = getCartView();
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
        cartTotal={total}
      />
    </div>
  );
}
