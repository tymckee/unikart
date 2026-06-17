"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { setProductCollections } from "@/lib/actions";
import { collectionIcon } from "@/components/collections/CollectionSpokeMap";
import { GlassCard } from "@/components/ui/GlassCard";

interface CollectionOption {
  id: string;
  name: string;
  icon: string;
}

export function ProductCollectionsCard({
  productId,
  selectedIds,
  allCollections,
}: {
  productId: string;
  selectedIds: string[];
  allCollections: CollectionOption[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set(selectedIds));

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    startTransition(async () => {
      await setProductCollections(productId, [...next]);
      router.refresh();
    });
  };

  return (
    <GlassCard variant="solid" className="p-5">
      <h3 className="mb-3 text-sm font-semibold text-ink">Collections</h3>
      <div className="flex flex-wrap gap-2">
        {allCollections.map((c) => {
          const Icon = collectionIcon(c.icon);
          const on = selected.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
                on
                  ? "border-accent/30 bg-accent-soft text-accent-ink"
                  : "border-line bg-white text-slate hover:border-line-strong hover:text-ink",
              )}
            >
              {on ? <Check size={13} /> : <Icon size={13} strokeWidth={1.7} />}
              {c.name}
            </button>
          );
        })}
      </div>
    </GlassCard>
  );
}
