"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { ProductView } from "@/lib/types";
import type { ParsePreview } from "@/lib/parse-preview";
import { mockCollections } from "@/lib/mock-data";

interface SaveOptions {
  collectionId?: string;
  targetPrice?: number | null;
  watch?: boolean;
}

interface HubContextValue {
  added: ProductView[];
  add: (preview: ParsePreview, opts: SaveOptions) => ProductView;
}

const HubContext = createContext<HubContextValue | null>(null);
const STORAGE_KEY = "unikart_added_v1";

function previewToProductView(
  preview: ParsePreview,
  opts: SaveOptions,
  id: string,
  now: string,
): ProductView {
  const collection = mockCollections.find((c) => c.id === opts.collectionId);
  return {
    id,
    userId: "user_1",
    title: preview.title,
    description: preview.description,
    originalUrl: preview.originalUrl,
    canonicalUrl: preview.canonicalUrl,
    imageUrl: preview.imageUrl ?? null,
    storeName: preview.storeName,
    storeDomain: preview.storeDomain,
    brand: preview.brand ?? null,
    sku: preview.sku ?? null,
    category: preview.category,
    currency: preview.currency,
    currentPrice: preview.price,
    previousPrice: null,
    lowestPrice: preview.price,
    highestPrice: preview.price,
    availability: preview.availability,
    metadataConfidence: preview.confidence,
    notes: null,
    isArchived: false,
    isPurchased: false,
    purchasedAt: null,
    createdAt: now,
    updatedAt: now,
    lastCheckedAt: now,
    collections: collection ? [collection] : [],
    priceHistory:
      preview.price != null
        ? [
            {
              id: `${id}-snap-0`,
              productId: id,
              price: preview.price,
              currency: preview.currency,
              source: "parser",
              checkedAt: now,
            },
          ]
        : [],
    alert:
      opts.watch || opts.targetPrice
        ? {
            id: `${id}-alert`,
            productId: id,
            userId: "user_1",
            type: opts.targetPrice ? "target_price" : "price_drop",
            targetPrice: opts.targetPrice ?? null,
            enabled: true,
            createdAt: now,
            updatedAt: now,
          }
        : null,
    inCart: false,
  };
}

/**
 * Session-scoped store for products saved during a visit. Backed by
 * sessionStorage so a save on the landing page survives navigation to
 * the Hub. Replaced by Prisma persistence in Phase 2.
 */
export function HubProvider({ children }: { children: React.ReactNode }) {
  const [added, setAdded] = useState<ProductView[]>([]);

  useEffect(() => {
    // Hydrate from sessionStorage on mount. This must run in an effect (not a
    // lazy initializer) so the first client render matches the server's empty
    // state and avoids a hydration mismatch.
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setAdded(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const add = useCallback(
    (preview: ParsePreview, opts: SaveOptions) => {
      const id = `added_${
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID().slice(0, 8)
          : Date.now().toString(36)
      }`;
      const view = previewToProductView(
        preview,
        opts,
        id,
        new Date().toISOString(),
      );
      setAdded((prev) => {
        const next = [view, ...prev];
        try {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      return view;
    },
    [],
  );

  return (
    <HubContext.Provider value={{ added, add }}>{children}</HubContext.Provider>
  );
}

/** Returns null when used outside a HubProvider (e.g. the landing page). */
export function useHub(): HubContextValue | null {
  return useContext(HubContext);
}
