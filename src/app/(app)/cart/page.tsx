import type { Metadata } from "next";
import { getCartView } from "@/lib/data";
import { PageHeader } from "@/components/layout/PageHeader";
import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = { title: "Universal Cart" };
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const { items } = await getCartView();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="The Rim"
        title="Universal Cart"
        subtitle="Everything you're ready to buy, grouped by store. One calm flow guides you through each checkout."
      />
      <CartView initial={items} />
    </div>
  );
}
