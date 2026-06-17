import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getCartView } from "@/lib/mock-data";
import { PageHeader } from "@/components/layout/PageHeader";
import { CheckoutAssistant } from "@/components/cart/CheckoutAssistant";

export const metadata: Metadata = { title: "Checkout Assistant" };

export default function CheckoutAssistantPage() {
  const { items } = getCartView();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/cart"
        className="inline-flex items-center gap-1 text-sm text-slate transition-colors hover:text-ink"
      >
        <ChevronLeft size={16} /> Universal Cart
      </Link>
      <PageHeader
        title="Checkout Assistant"
        subtitle="We verify, group by store, and guide you through each checkout — one calm step at a time."
      />
      <CheckoutAssistant initial={items} />
    </div>
  );
}
