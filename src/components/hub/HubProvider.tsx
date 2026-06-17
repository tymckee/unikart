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

// Placeholder owner id for the client-only, session-scoped store. These objects
// live in sessionStorage and are never persisted to the DB, so the value is
// cosmetic (it only satisfies the ProductView type). The real owner id is
// passed in by the authenticated (app) layout; the public /demo uses the
// default so it works without an account.
const DEMO_USER_ID = "demo";

function previewToProductView(
  preview: ParsePreview,
  opts: SaveOptions,
  id: string,
  now: string,
  userId: string,
): ProductView {
  const collection = mockCollections.find((c) => c.id === opts.collectionId);
  return {
    id,
    userId,
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
            userId,
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
 * the Hub. Used in-memory by the public /demo (no account) and as a
 * client-side overlay in the authenticated app.
 *
 * `userId` is the owner stamped onto the synthetic ProductViews. The
 * authenticated (app) layout passes the real session id; /demo omits it and
 * falls back to a demo placeholder.
 */
export function HubProvider({
  children,
  userId = DEMO_USER_ID,
}: {
  children: React.ReactNode;
  userId?: string;
}) {
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
        userId,
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
    [userId],
  );

  return (
    <HubContext.Provider value={{ added, add }}>{children}</HubContext.Provider>
  );
}

/** Returns null when used outside a HubProvider (e.g. the landing page). */
export function useHub(): HubContextValue | null {
  return useContext(HubContext);
}
