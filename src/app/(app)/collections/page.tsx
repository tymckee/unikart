import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCollectionsWithCounts, getProductViews } from "@/lib/data";
import type { ProductView } from "@/lib/types";
import { PageHeader } from "@/components/layout/PageHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Pill } from "@/components/ui/Pill";
import { ProductTile } from "@/components/product/ProductTile";
import {
  CollectionSpokeMap,
  collectionIcon,
} from "@/components/collections/CollectionSpokeMap";
import { NewCollectionButton } from "@/components/collections/NewCollectionButton";

export const metadata: Metadata = { title: "Collections" };
export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const [collections, products] = await Promise.all([
    getCollectionsWithCounts(),
    getProductViews(),
  ]);
  const total = products.filter((p) => !p.isArchived).length;

  const byCollection = (id: string): ProductView[] =>
    products.filter((p) => p.collections.some((c) => c.id === id));

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Collections"
        title="Collections"
        subtitle="Group what you save into collections — Tech, Home, Gifts, Travel. Each one is part of the same wheel."
        action={<NewCollectionButton />}
      />

      <GlassCard variant="solid" className="p-6 sm:p-10">
        <CollectionSpokeMap collections={collections} total={total} />
      </GlassCard>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {collections.map((c) => {
          const items = byCollection(c.id);
          const Icon = collectionIcon(c.icon);
          return (
            <GlassCard
              key={c.id}
              id={c.id}
              variant="solid"
              interactive
              className="scroll-mt-24 p-5"
            >
              <Link href={`/collections#${c.id}`} className="block">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-canvas text-slate">
                      <Icon size={18} strokeWidth={1.6} />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-ink">
                        {c.name}
                      </h3>
                      <p className="text-xs text-slate">
                        {c.count} {c.count === 1 ? "item" : "items"}
                      </p>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-silver" />
                </div>

                {items.length > 0 ? (
                  <div className="mt-4 flex gap-2">
                    {items.slice(0, 3).map((p) => (
                      <ProductTile
                        key={p.id}
                        category={p.category}
                        imageUrl={p.imageUrl}
                        title={p.title}
                        className="aspect-square flex-1 rounded-lg"
                        iconSize={22}
                        watermark={false}
                      />
                    ))}
                    {items.length > 3 && (
                      <div className="flex aspect-square flex-1 items-center justify-center rounded-lg bg-canvas text-xs font-medium text-slate">
                        +{items.length - 3}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 rounded-lg bg-canvas px-3 py-4 text-center text-xs text-silver">
                    Nothing here yet
                  </p>
                )}
              </Link>
            </GlassCard>
          );
        })}
      </div>

      <p className="flex items-center gap-2 text-xs text-silver">
        <Pill tone="outline">Tip</Pill>
        Save a product, then assign it to a collection from its page.
      </p>
    </div>
  );
}
