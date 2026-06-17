/* ============================================================
   UniKart — Domain types
   These mirror the planned Prisma models so the UI built on
   mock data in Phase 1 maps 1:1 to the database in Phase 2.
   ============================================================ */

export type Availability =
  | "in_stock"
  | "low_stock"
  | "out_of_stock"
  | "preorder"
  | "unknown";

export type MetadataConfidence = "high" | "medium" | "low";

export type AlertType =
  | "price_drop"
  | "price_rise"
  | "target_price"
  | "back_in_stock"
  | "out_of_stock";

export type NotificationType =
  | "price_dropped"
  | "target_reached"
  | "back_in_stock"
  | "out_of_stock"
  | "price_increased"
  | "cart_reminder"
  | "checkout_incomplete";

export type CartStatus = "active" | "checking_out" | "completed" | "archived";

export type CheckoutStepStatus =
  | "pending"
  | "ready"
  | "opened"
  | "completed"
  | "skipped";

export type IntegrationType =
  | "merchant"
  | "payment"
  | "bnpl"
  | "agentic"
  | "affiliate";

export type BuyVerdict = "buy" | "wait" | "watch";

export interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  plan: "free" | "pro";
  createdAt: string;
  updatedAt: string;
}

export interface Collection {
  id: string;
  userId: string;
  name: string;
  icon: string; // lucide-style key or emoji-free glyph token
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PriceSnapshot {
  id: string;
  productId: string;
  price: number;
  currency: string;
  source: "mock" | "parser" | "manual" | "scheduled";
  checkedAt: string;
}

export interface StockSnapshot {
  id: string;
  productId: string;
  availability: Availability;
  source: "mock" | "parser" | "manual" | "scheduled";
  checkedAt: string;
}

export interface AlertRule {
  id: string;
  productId: string;
  userId: string;
  type: AlertType;
  targetPrice?: number | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  userId: string;
  title: string;
  description?: string | null;
  originalUrl: string;
  canonicalUrl?: string | null;
  imageUrl?: string | null;
  /** Background-removed product shot (AI). Preferred on cards when present. */
  cutoutUrl?: string | null;
  storeName: string;
  storeDomain: string;
  brand?: string | null;
  sku?: string | null;
  category?: string | null;
  currency: string;
  currentPrice: number | null;
  previousPrice?: number | null;
  lowestPrice?: number | null;
  highestPrice?: number | null;
  availability: Availability;
  metadataConfidence: MetadataConfidence;
  /** AI "the gist" cache — JSON string of { summary[], specs[] }. */
  gist?: string | null;
  notes?: string | null;
  isArchived: boolean;
  isPurchased: boolean;
  purchasedAt?: string | null;
  /** When the user consciously let this go (released the urge to buy). */
  releasedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt?: string | null;
}

export interface Notification {
  id: string;
  userId: string;
  productId?: string | null;
  cartId?: string | null;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface UniversalCart {
  id: string;
  userId: string;
  name: string;
  status: CartStatus;
  createdAt: string;
  updatedAt: string;
}

export interface UniversalCartItem {
  id: string;
  cartId: string;
  productId: string;
  quantity: number;
  merchantStatus: Availability;
  checkoutStatus: CheckoutStepStatus;
  addedAt: string;
  completedAt?: string | null;
}

export interface CheckoutStep {
  id: string;
  cartId: string;
  storeDomain: string;
  storeName: string;
  status: CheckoutStepStatus;
  estimatedSubtotal: number;
  currency: string;
  checkoutUrl?: string | null;
  itemIds: string[];
  openedAt?: string | null;
  completedAt?: string | null;
}

export interface IntegrationAdapter {
  id: string;
  name: string;
  type: IntegrationType;
  enabled: boolean;
  status: "live" | "planned" | "beta";
  description: string;
  configJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/* ---- Derived view models used by the UI ---- */

export interface ProductView extends Product {
  collections: Collection[];
  priceHistory: PriceSnapshot[];
  alert?: AlertRule | null;
  inCart: boolean;
}
