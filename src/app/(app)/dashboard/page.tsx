import type { Metadata } from "next";
import { HubView } from "@/components/hub/HubView";
import {
  getCartView,
  getProductViews,
  mockNotifications,
} from "@/lib/mock-data";

export const metadata: Metadata = { title: "Hub" };

export default function DashboardPage() {
  const products = getProductViews();
  const { total } = getCartView();
  const backInStockIds = mockNotifications
    .filter((n) => n.type === "back_in_stock" && n.productId)
    .map((n) => n.productId as string);

  return (
    <HubView
      initial={products}
      backInStockIds={backInStockIds}
      cartTotal={total}
    />
  );
}
