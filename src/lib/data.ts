import type { Prisma } from "@/generated/prisma";
import { hasDatabase, prisma } from "./db";
import { getCurrentUserId } from "./auth-helpers";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "./notifications";
import * as mock from "./mock-data";
import type {
  AlertRule,
  AlertType,
  Availability,
  CartStatus,
  CheckoutStep,
  CheckoutStepStatus,
  Collection,
  MetadataConfidence,
  Notification,
  NotificationPreferences,
  NotificationType,
  PriceSnapshot,
  ProductView,
  UniversalCart,
  UniversalCartItem,
} from "./types";

/**
 * Read-side data access. Each function uses Prisma when a database is
 * configured and otherwise falls back to the mock selectors, so the app
 * renders with or without a DATABASE_URL. Swapping SQLite → Postgres needs
 * no changes here.
 *
 * Every Prisma-backed selector is scoped to the authenticated user
 * (`getCurrentUserId`). When there's no session the selector returns empty —
 * the (app) route group redirects unauthenticated visitors before these run,
 * so an empty result is just a safe backstop. The mock fallback (no
 * DATABASE_URL) is intentionally unscoped: it powers the public /demo, which
 * works without an account.
 */

const iso = (d: Date): string => d.toISOString();
const isoN = (d: Date | null): string | null => (d ? d.toISOString() : null);

const productInclude = {
  collections: { include: { collection: true } },
  priceSnapshots: { orderBy: { checkedAt: "asc" } },
  alerts: { where: { enabled: true }, orderBy: { updatedAt: "desc" } },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;
type CollectionRow = Prisma.CollectionGetPayload<object>;
type SnapshotRow = Prisma.PriceSnapshotGetPayload<object>;
type AlertRow = Prisma.AlertRuleGetPayload<object>;

function mapCollection(c: CollectionRow): Collection {
  return {
    id: c.id,
    userId: c.userId,
    name: c.name,
    icon: c.icon,
    sortOrder: c.sortOrder,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
}

function mapSnapshot(s: SnapshotRow): PriceSnapshot {
  return {
    id: s.id,
    productId: s.productId,
    price: s.price,
    currency: s.currency,
    source: s.source as PriceSnapshot["source"],
    checkedAt: iso(s.checkedAt),
  };
}

function mapAlert(a: AlertRow): AlertRule {
  return {
    id: a.id,
    productId: a.productId,
    userId: a.userId,
    type: a.type as AlertType,
    targetPrice: a.targetPrice,
    enabled: a.enabled,
    createdAt: iso(a.createdAt),
    updatedAt: iso(a.updatedAt),
  };
}

function mapProduct(p: ProductWithRelations, cartIds: Set<string>): ProductView {
  return {
    id: p.id,
    userId: p.userId,
    title: p.title,
    description: p.description,
    originalUrl: p.originalUrl,
    canonicalUrl: p.canonicalUrl,
    imageUrl: p.imageUrl,
    cutoutUrl: p.cutoutUrl,
    storeName: p.storeName,
    storeDomain: p.storeDomain,
    brand: p.brand,
    sku: p.sku,
    category: p.category,
    currency: p.currency,
    currentPrice: p.currentPrice,
    previousPrice: p.previousPrice,
    lowestPrice: p.lowestPrice,
    highestPrice: p.highestPrice,
    availability: p.availability as Availability,
    metadataConfidence: p.metadataConfidence as MetadataConfidence,
    gist: p.gist,
    notes: p.notes,
    isArchived: p.isArchived,
    isPurchased: p.isPurchased,
    purchasedAt: isoN(p.purchasedAt),
    releasedAt: isoN(p.releasedAt),
    createdAt: iso(p.createdAt),
    updatedAt: iso(p.updatedAt),
    lastCheckedAt: isoN(p.lastCheckedAt),
    collections: p.collections.map((pc) => mapCollection(pc.collection)),
    priceHistory: p.priceSnapshots.map(mapSnapshot),
    alert: p.alerts[0] ? mapAlert(p.alerts[0]) : null,
    inCart: cartIds.has(p.id),
  };
}

async function activeCartProductIds(userId: string): Promise<Set<string>> {
  const cart = await prisma.universalCart.findFirst({
    where: { userId, status: "active" },
    include: { items: { select: { productId: true } } },
  });
  return new Set(cart?.items.map((i) => i.productId) ?? []);
}

export async function getProductViews(): Promise<ProductView[]> {
  if (!hasDatabase()) return mock.getProductViews();
  try {
    const userId = await getCurrentUserId();
    if (!userId) return [];
    const cartIds = await activeCartProductIds(userId);
    const products = await prisma.product.findMany({
      where: { userId },
      include: productInclude,
      orderBy: { createdAt: "desc" },
    });
    return products.map((p) => mapProduct(p, cartIds));
  } catch (e) {
    console.error("[data] getProductViews fell back to mock:", e);
    return mock.getProductViews();
  }
}

export async function getProductView(
  id: string,
): Promise<ProductView | undefined> {
  if (!hasDatabase()) return mock.getProductView(id);
  try {
    const userId = await getCurrentUserId();
    if (!userId) return undefined;
    // Scope to the owner: a user can only ever load their own product.
    const p = await prisma.product.findFirst({
      where: { id, userId },
      include: productInclude,
    });
    if (!p) return undefined;
    const cartIds = await activeCartProductIds(userId);
    return mapProduct(p, cartIds);
  } catch (e) {
    console.error("[data] getProductView fell back to mock:", e);
    return mock.getProductView(id);
  }
}

export async function getCollectionsWithCounts() {
  if (!hasDatabase()) return mock.getCollectionsWithCounts();
  try {
    const userId = await getCurrentUserId();
    if (!userId) return [];
    const cols = await prisma.collection.findMany({
      where: { userId },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { products: true } } },
    });
    return cols.map((c) => ({ ...mapCollection(c), count: c._count.products }));
  } catch (e) {
    console.error("[data] getCollectionsWithCounts fell back to mock:", e);
    return mock.getCollectionsWithCounts();
  }
}

function mapCart(c: Prisma.UniversalCartGetPayload<object>): UniversalCart {
  return {
    id: c.id,
    userId: c.userId,
    name: c.name,
    status: c.status as CartStatus,
    createdAt: iso(c.createdAt),
    updatedAt: iso(c.updatedAt),
  };
}

function mapCartItem(
  i: Prisma.UniversalCartItemGetPayload<object>,
): UniversalCartItem {
  return {
    id: i.id,
    cartId: i.cartId,
    productId: i.productId,
    quantity: i.quantity,
    merchantStatus: i.merchantStatus as Availability,
    checkoutStatus: i.checkoutStatus as CheckoutStepStatus,
    addedAt: iso(i.addedAt),
    completedAt: isoN(i.completedAt),
  };
}

function computeSteps(
  cartId: string,
  rows: { item: UniversalCartItem; product: ProductView }[],
): CheckoutStep[] {
  const byDomain = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.product.storeDomain;
    byDomain.set(key, [...(byDomain.get(key) ?? []), r]);
  }
  return [...byDomain.entries()].map(([domain, list], idx) => ({
    id: `${cartId}-step-${idx + 1}`,
    cartId,
    storeDomain: domain,
    storeName: list[0].product.storeName,
    status: "pending" as CheckoutStepStatus,
    estimatedSubtotal:
      Math.round(
        list.reduce(
          (s, r) => s + (r.product.currentPrice ?? 0) * r.item.quantity,
          0,
        ) * 100,
      ) / 100,
    currency: "USD",
    checkoutUrl: null,
    itemIds: list.map((r) => r.item.id),
  }));
}

function emptyCartView(userId: string) {
  const placeholder: UniversalCart = {
    id: "cart_empty",
    userId,
    name: "Universal Cart",
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return { cart: placeholder, items: [], steps: [], total: 0 };
}

export async function getCartView() {
  if (!hasDatabase()) return mock.getCartView();
  try {
    const userId = await getCurrentUserId();
    if (!userId) return emptyCartView("");
    const cart = await prisma.universalCart.findFirst({
      where: { userId, status: "active" },
    });
    if (!cart) return emptyCartView(userId);
    const items = await prisma.universalCartItem.findMany({
      where: { cartId: cart.id },
      include: { product: { include: productInclude } },
      orderBy: { addedAt: "asc" },
    });
    const cartIds = new Set(items.map((i) => i.productId));
    const rows = items.map((i) => ({
      item: mapCartItem(i),
      product: mapProduct(i.product, cartIds),
    }));
    const total = rows.reduce(
      (s, { item, product }) => s + (product.currentPrice ?? 0) * item.quantity,
      0,
    );
    return {
      cart: mapCart(cart),
      items: rows,
      steps: computeSteps(cart.id, rows),
      total,
    };
  } catch (e) {
    console.error("[data] getCartView fell back to mock:", e);
    return mock.getCartView();
  }
}

export async function getNotifications(): Promise<Notification[]> {
  if (!hasDatabase()) return mock.mockNotifications;
  try {
    const userId = await getCurrentUserId();
    if (!userId) return [];
    const rows = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((n) => ({
      id: n.id,
      userId: n.userId,
      productId: n.productId,
      cartId: n.cartId,
      type: n.type as NotificationType,
      title: n.title,
      body: n.body,
      read: n.read,
      createdAt: iso(n.createdAt),
    }));
  } catch (e) {
    console.error("[data] getNotifications fell back to mock:", e);
    return mock.mockNotifications;
  }
}

export async function getUnreadCount(): Promise<number> {
  if (!hasDatabase()) return mock.getUnreadCount();
  try {
    const userId = await getCurrentUserId();
    if (!userId) return 0;
    return await prisma.notification.count({
      where: { userId, read: false },
    });
  } catch (e) {
    console.error("[data] getUnreadCount fell back to mock:", e);
    return mock.getUnreadCount();
  }
}

/**
 * The signed-in user's notification preferences, with calm defaults applied
 * when no row exists yet (so the settings form always has a complete shape to
 * render). Returns defaults — never throws — when there's no DB or no session.
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  if (!hasDatabase()) return DEFAULT_NOTIFICATION_PREFERENCES;
  try {
    const userId = await getCurrentUserId();
    if (!userId) return DEFAULT_NOTIFICATION_PREFERENCES;
    const row = await prisma.notificationPreferences.findUnique({
      where: { userId },
    });
    if (!row) return DEFAULT_NOTIFICATION_PREFERENCES;
    return {
      emailEnabled: row.emailEnabled,
      digestFrequency: row.digestFrequency === "weekly" ? "weekly" : "daily",
      digestSendHour: row.digestSendHour,
      digestWeekday: row.digestWeekday,
      timezone: row.timezone,
    };
  } catch (e) {
    console.error("[data] getNotificationPreferences fell back to defaults:", e);
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

/** Product ids that have a back-in-stock notification (Hub filter). */
export async function getBackInStockIds(): Promise<string[]> {
  const notes = await getNotifications();
  return notes
    .filter((n) => n.type === "back_in_stock" && n.productId)
    .map((n) => n.productId as string);
}
