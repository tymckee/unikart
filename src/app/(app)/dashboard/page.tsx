import type { Metadata } from "next";
import { HubView } from "@/components/hub/HubView";
import {
  getBackInStockIds,
  getCartView,
  getCollectionsWithCounts,
  getProductViews,
} from "@/lib/data";

export const metadata: Metadata = { title: "Hub" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [products, cart, backInStockIds, collections] = await Promise.all([
    getProductViews(),
    getCartView(),
    getBackInStockIds(),
    getCollectionsWithCounts(),
  ]);

  return (
    <HubView
      initial={products}
      backInStockIds={backInStockIds}
      cartTotal={cart.total}
      collections={collections.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
