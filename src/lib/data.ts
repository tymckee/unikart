import type { Prisma } from "@/generated/prisma";
import { hasDatabase, prisma } from "./db";
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
 */

const USER_ID = "user_1";

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
    notes: p.notes,
    isArchived: p.isArchived,
    isPurchased: p.isPurchased,
    purchasedAt: isoN(p.purchasedAt),
    createdAt: iso(p.createdAt),
    updatedAt: iso(p.updatedAt),
    lastCheckedAt: isoN(p.lastCheckedAt),
    collections: p.collections.map((pc) => mapCollection(pc.collection)),
    priceHistory: p.priceSnapshots.map(mapSnapshot),
    alert: p.alerts[0] ? mapAlert(p.alerts[0]) : null,
    inCart: cartIds.has(p.id),
  };
}

async function activeCartProductIds(): Promise<Set<string>> {
  const cart = await prisma.universalCart.findFirst({
    where: { userId: USER_ID, status: "active" },
    include: { items: { select: { productId: true } } },
  });
  return new Set(cart?.items.map((i) => i.productId) ?? []);
}

export async function getProductViews(): Promise<ProductView[]> {
  if (!hasDatabase()) return mock.getProductViews();
  try {
    const cartIds = await activeCartProductIds();
    const products = await prisma.product.findMany({
      where: { userId: USER_ID },
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
    const p = await prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!p) return undefined;
    const cartIds = await activeCartProductIds();
    return mapProduct(p, cartIds);
  } catch (e) {
    console.error("[data] getProductView fell back to mock:", e);
    return mock.getProductView(id);
  }
}

export async function getCollectionsWithCounts() {
  if (!hasDatabase()) return mock.getCollectionsWithCounts();
  try {
    const cols = await prisma.collection.findMany({
      where: { userId: USER_ID },
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

export async function getCartView() {
  if (!hasDatabase()) return mock.getCartView();
  try {
    const cart = await prisma.universalCart.findFirst({
      where: { userId: USER_ID, status: "active" },
    });
    if (!cart) {
      const placeholder: UniversalCart = {
        id: "cart_empty",
        userId: USER_ID,
        name: "Universal Cart",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return { cart: placeholder, items: [], steps: [], total: 0 };
    }
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
    const rows = await prisma.notification.findMany({
      where: { userId: USER_ID },
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
    return await prisma.notification.count({
      where: { userId: USER_ID, read: false },
    });
  } catch (e) {
    console.error("[data] getUnreadCount fell back to mock:", e);
    return mock.getUnreadCount();
  }
}

/** Product ids that have a back-in-stock notification (Hub filter). */
export async function getBackInStockIds(): Promise<string[]> {
  const notes = await getNotifications();
  return notes
    .filter((n) => n.type === "back_in_stock" && n.productId)
    .map((n) => n.productId as string);
}
