/**
 * UniKart Ops — Products data access.
 *
 * Server-only reads for the Products list (/ops/products) and detail
 * (/ops/products/[id]) pages. All queries guard `hasDatabase()` and wrap in
 * try/catch, returning a safe fallback so the console always renders.
 *
 * Tracking state is derived (never a stored column): a product is "tracking"
 * unless it has been purchased, released, or archived — in which case that
 * state is shown instead. Totals/derivations live here so the list and detail
 * agree (one source of truth).
 */
import { hasDatabase, prisma } from "../../db";
import type { ListParams } from "./common";

const STALE_MS = 7 * 86_400_000;

export type TrackingState = "tracking" | "purchased" | "released" | "archived";

/** A product as shown in the list table. */
export interface ProductListRow {
  id: string;
  title: string;
  brand: string | null;
  storeName: string;
  storeDomain: string;
  userEmail: string;
  currency: string;
  currentPrice: number | null;
  previousPrice: number | null;
  availability: string;
  metadataConfidence: string;
  lastCheckedAt: string | null;
  createdAt: string;
  trackingState: TrackingState;
  collectionName: string | null;
  inActiveCart: boolean;
  priceChanged: boolean;
}

/** Derive the single tracking state from the lifecycle flags. */
function trackingStateOf(p: {
  isArchived: boolean;
  isPurchased: boolean;
  releasedAt: Date | null;
}): TrackingState {
  if (p.isPurchased) return "purchased";
  if (p.releasedAt) return "released";
  if (p.isArchived) return "archived";
  return "tracking";
}

const SORTABLE: Record<string, string> = {
  createdAt: "createdAt",
  currentPrice: "currentPrice",
  lastCheckedAt: "lastCheckedAt",
};

/**
 * Build the Prisma `where` from the list params (search + select filters).
 * Filters: domain, confidence, availability, status (tracking lifecycle),
 * stale, failed (low-confidence parse), changed (price moved), cart.
 */
function buildWhere(lp: ListParams): Record<string, unknown> {
  const where: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];

  if (lp.q) {
    where.OR = [
      { title: { contains: lp.q, mode: "insensitive" } },
      { brand: { contains: lp.q, mode: "insensitive" } },
      { storeName: { contains: lp.q, mode: "insensitive" } },
      { storeDomain: { contains: lp.q, mode: "insensitive" } },
    ];
  }

  const domain = lp.params.domain;
  if (domain) where.storeDomain = domain;

  const confidence = lp.params.confidence;
  if (confidence && ["high", "medium", "low"].includes(confidence)) {
    where.metadataConfidence = confidence;
  }

  const availability = lp.params.availability;
  if (availability) where.availability = availability;

  switch (lp.params.status) {
    case "active":
      and.push({ isArchived: false, isPurchased: false, releasedAt: null });
      break;
    case "archived":
      where.isArchived = true;
      break;
    case "released":
      where.releasedAt = { not: null };
      break;
    case "purchased":
      where.isPurchased = true;
      break;
  }

  // Stale: not checked in the last 7 days (or never checked).
  if (lp.params.stale === "yes") {
    and.push({
      OR: [{ lastCheckedAt: null }, { lastCheckedAt: { lt: new Date(Date.now() - STALE_MS) } }],
    });
  }

  // Failed parse proxy: low metadata confidence.
  if (lp.params.failed === "yes") where.metadataConfidence = "low";

  // In an active cart.
  if (lp.params.cart === "yes") {
    and.push({ cartItems: { some: { cart: { status: "active" } } } });
  }

  if (and.length) where.AND = and;
  return where;
}

/**
 * The list query. Reads q + filters from `lp`, applies the matching where +
 * orderBy + skip/take, and returns the page of rows + the total count.
 *
 * The "price changed" filter (currentPrice != previousPrice) can't be a Prisma
 * column-to-column comparison in a single where, so it's applied in-memory on
 * the page after fetching; the returned `total` then reflects the filtered set.
 * Other filters stay fully server-side.
 */
export async function getProducts(
  lp: ListParams,
): Promise<{ rows: ProductListRow[]; total: number }> {
  if (!hasDatabase()) return { rows: [], total: 0 };

  const where = buildWhere(lp);
  const sortKey = lp.sort && SORTABLE[lp.sort.key] ? SORTABLE[lp.sort.key] : "createdAt";
  const sortDir = lp.sort?.dir === "asc" ? "asc" : "desc";
  const wantChanged = lp.params.changed === "yes";

  try {
    if (wantChanged) {
      // Column-to-column comparison isn't expressible in a single Prisma where,
      // so narrow with raw price fields, then compare + paginate in memory.
      const candidates = await prisma.product.findMany({
        where: { ...where, currentPrice: { not: null }, previousPrice: { not: null } },
        orderBy: { [sortKey]: sortDir },
        select: PRODUCT_LIST_SELECT,
      });
      const changed = candidates.filter((p) => p.currentPrice !== p.previousPrice);
      const total = changed.length;
      const start = (lp.page - 1) * lp.pageSize;
      const pageRows = changed.slice(start, start + lp.pageSize);
      return { rows: pageRows.map(mapListRow), total };
    }

    const [rows, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { [sortKey]: sortDir },
        skip: (lp.page - 1) * lp.pageSize,
        take: lp.pageSize,
        select: PRODUCT_LIST_SELECT,
      }),
      prisma.product.count({ where }),
    ]);
    return { rows: rows.map(mapListRow), total };
  } catch (e) {
    console.error("[ops] getProducts:", e);
    return { rows: [], total: 0 };
  }
}

const PRODUCT_LIST_SELECT = {
  id: true,
  title: true,
  brand: true,
  storeName: true,
  storeDomain: true,
  currency: true,
  currentPrice: true,
  previousPrice: true,
  availability: true,
  metadataConfidence: true,
  lastCheckedAt: true,
  createdAt: true,
  isArchived: true,
  isPurchased: true,
  releasedAt: true,
  user: { select: { email: true } },
  collections: {
    take: 1,
    select: { collection: { select: { name: true } } },
  },
  cartItems: {
    where: { cart: { status: "active" } },
    take: 1,
    select: { id: true },
  },
} as const;

type ProductListRecord = {
  id: string;
  title: string;
  brand: string | null;
  storeName: string;
  storeDomain: string;
  currency: string;
  currentPrice: number | null;
  previousPrice: number | null;
  availability: string;
  metadataConfidence: string;
  lastCheckedAt: Date | null;
  createdAt: Date;
  isArchived: boolean;
  isPurchased: boolean;
  releasedAt: Date | null;
  user: { email: string } | null;
  collections: { collection: { name: string } }[];
  cartItems: { id: string }[];
};

function mapListRow(p: ProductListRecord): ProductListRow {
  return {
    id: p.id,
    title: p.title,
    brand: p.brand,
    storeName: p.storeName,
    storeDomain: p.storeDomain,
    userEmail: p.user?.email ?? "—",
    currency: p.currency,
    currentPrice: p.currentPrice,
    previousPrice: p.previousPrice,
    availability: p.availability,
    metadataConfidence: p.metadataConfidence,
    lastCheckedAt: p.lastCheckedAt ? p.lastCheckedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    trackingState: trackingStateOf(p),
    collectionName: p.collections[0]?.collection.name ?? null,
    inActiveCart: p.cartItems.length > 0,
    priceChanged:
      p.currentPrice != null && p.previousPrice != null && p.currentPrice !== p.previousPrice,
  };
}

/** Top store domains (for the list filter dropdown). */
export async function getTopProductDomains(limit = 20): Promise<{ value: string; label: string }[]> {
  if (!hasDatabase()) return [];
  try {
    const grouped = await prisma.product.groupBy({
      by: ["storeDomain"],
      _count: { storeDomain: true },
      orderBy: { _count: { storeDomain: "desc" } },
      take: limit,
    });
    return grouped
      .filter((g) => g.storeDomain)
      .map((g) => ({
        value: g.storeDomain,
        label: `${g.storeDomain} (${g._count.storeDomain})`,
      }));
  } catch (e) {
    console.error("[ops] getTopProductDomains:", e);
    return [];
  }
}

/* ----------------------------- Detail ----------------------------- */

export interface PricePoint {
  label: string;
  value: number;
  checkedAt: string;
  source: string;
}

export interface StockPoint {
  id: string;
  availability: string;
  source: string;
  checkedAt: string;
}

export interface ParseAttemptView {
  id: string;
  status: string;
  confidence: string | null;
  extractionMethod: string | null;
  durationMs: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface NotificationView {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export interface CartUsageView {
  cartId: string;
  cartName: string;
  cartStatus: string;
  quantity: number;
  checkoutStatus: string;
  addedAt: string;
}

export interface ProductDetail {
  id: string;
  userId: string;
  userEmail: string;
  title: string;
  description: string | null;
  originalUrl: string;
  canonicalUrl: string | null;
  imageUrl: string | null;
  cutoutUrl: string | null;
  storeName: string;
  storeDomain: string;
  brand: string | null;
  sku: string | null;
  category: string | null;
  currency: string;
  currentPrice: number | null;
  previousPrice: number | null;
  lowestPrice: number | null;
  highestPrice: number | null;
  availability: string;
  metadataConfidence: string;
  gist: string | null;
  /** User's own private notes — sensitive, only surfaced when present. */
  notes: string | null;
  trackingState: TrackingState;
  isArchived: boolean;
  isPurchased: boolean;
  purchasedAt: string | null;
  releasedAt: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  /** Sanitized non-sensitive sample of the raw parser metadata. */
  rawMetadataSafe: { key: string; value: string }[];
  priceHistory: PricePoint[];
  stockSnapshots: StockPoint[];
  parseAttempts: ParseAttemptView[];
  notifications: NotificationView[];
  cartUsage: CartUsageView[];
}

/** Keys we will surface from rawMetadata — anything else is dropped. */
const SAFE_RAW_KEYS = new Set([
  "title",
  "name",
  "brand",
  "sku",
  "price",
  "currency",
  "availability",
  "category",
  "image",
  "imageurl",
  "description",
  "store",
  "storename",
  "extractionmethod",
  "method",
  "confidence",
  "url",
  "canonicalurl",
]);

/** Keys that must never be surfaced even if present (defence in depth). */
const SECRET_RAW_KEY_RE =
  /(pass|secret|token|api[-_]?key|authorization|auth|cookie|session|bearer|private|cvv|cvc|card|pan|iban|account[-_]?number)/i;

/**
 * Parse rawMetadata JSON safely and pick a small set of non-sensitive,
 * primitive keys for display. Never dumps cookies/tokens/nested blobs.
 */
function sanitizeRawMetadata(raw: string | null): { key: string; value: string }[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];

  const out: { key: string; value: string }[] = [];
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (out.length >= 12) break;
    const lower = key.toLowerCase();
    if (SECRET_RAW_KEY_RE.test(key)) continue;
    if (!SAFE_RAW_KEYS.has(lower)) continue;
    if (value == null) continue;
    if (typeof value === "object") continue; // skip nested blobs entirely
    let str = String(value);
    if (str.length > 200) str = `${str.slice(0, 199)}…`;
    out.push({ key, value: str });
  }
  return out;
}

/** Full detail for one product, or null when missing / no DB. */
export async function getProductDetail(id: string): Promise<ProductDetail | null> {
  if (!hasDatabase()) return null;
  try {
    const p = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        title: true,
        description: true,
        originalUrl: true,
        canonicalUrl: true,
        imageUrl: true,
        cutoutUrl: true,
        storeName: true,
        storeDomain: true,
        brand: true,
        sku: true,
        category: true,
        currency: true,
        currentPrice: true,
        previousPrice: true,
        lowestPrice: true,
        highestPrice: true,
        availability: true,
        metadataConfidence: true,
        rawMetadata: true,
        gist: true,
        notes: true,
        isArchived: true,
        isPurchased: true,
        purchasedAt: true,
        releasedAt: true,
        lastCheckedAt: true,
        createdAt: true,
        user: { select: { email: true } },
        priceSnapshots: {
          orderBy: { checkedAt: "asc" },
          take: 90,
          select: { price: true, source: true, checkedAt: true },
        },
        stockSnapshots: {
          orderBy: { checkedAt: "desc" },
          take: 20,
          select: { id: true, availability: true, source: true, checkedAt: true },
        },
      },
    });
    if (!p) return null;

    // Related rows fetched separately (ParseAttempt + Notification aren't
    // declared relations on Product).
    const [parseAttempts, notifications, cartItems] = await Promise.all([
      prisma.parseAttempt.findMany({
        where: { productId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          confidence: true,
          extractionMethod: true,
          durationMs: true,
          errorCode: true,
          errorMessage: true,
          createdAt: true,
        },
      }),
      prisma.notification.findMany({
        where: { productId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, type: true, title: true, body: true, read: true, createdAt: true },
      }),
      prisma.universalCartItem.findMany({
        where: { productId: id },
        orderBy: { addedAt: "desc" },
        take: 20,
        select: {
          quantity: true,
          checkoutStatus: true,
          addedAt: true,
          cart: { select: { id: true, name: true, status: true } },
        },
      }),
    ]);

    const dateFmt = (d: Date) =>
      d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

    return {
      id: p.id,
      userId: p.userId,
      userEmail: p.user?.email ?? "—",
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
      availability: p.availability,
      metadataConfidence: p.metadataConfidence,
      gist: p.gist,
      notes: p.notes,
      trackingState: trackingStateOf(p),
      isArchived: p.isArchived,
      isPurchased: p.isPurchased,
      purchasedAt: p.purchasedAt ? p.purchasedAt.toISOString() : null,
      releasedAt: p.releasedAt ? p.releasedAt.toISOString() : null,
      lastCheckedAt: p.lastCheckedAt ? p.lastCheckedAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      rawMetadataSafe: sanitizeRawMetadata(p.rawMetadata),
      priceHistory: p.priceSnapshots.map((s) => ({
        label: dateFmt(s.checkedAt),
        value: s.price,
        checkedAt: s.checkedAt.toISOString(),
        source: s.source,
      })),
      stockSnapshots: p.stockSnapshots.map((s) => ({
        id: s.id,
        availability: s.availability,
        source: s.source,
        checkedAt: s.checkedAt.toISOString(),
      })),
      parseAttempts: parseAttempts.map((a) => ({
        id: a.id,
        status: a.status,
        confidence: a.confidence,
        extractionMethod: a.extractionMethod,
        durationMs: a.durationMs,
        errorCode: a.errorCode,
        errorMessage: a.errorMessage,
        createdAt: a.createdAt.toISOString(),
      })),
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      })),
      cartUsage: cartItems.map((c) => ({
        cartId: c.cart.id,
        cartName: c.cart.name,
        cartStatus: c.cart.status,
        quantity: c.quantity,
        checkoutStatus: c.checkoutStatus,
        addedAt: c.addedAt.toISOString(),
      })),
    };
  } catch (e) {
    console.error("[ops] getProductDetail:", e);
    return null;
  }
}

/**
 * Rows for the CSV export. Honours the same filters as the list (so an operator
 * exports what they're looking at) but ignores pagination, capped for safety.
 */
export async function getProductsForExport(
  lp: ListParams,
  cap = 5000,
): Promise<
  {
    id: string;
    title: string;
    storeDomain: string;
    userEmail: string;
    currentPrice: number | null;
    availability: string;
    metadataConfidence: string;
    lastCheckedAt: string | null;
  }[]
> {
  if (!hasDatabase()) return [];
  const where = buildWhere(lp);
  const sortKey = lp.sort && SORTABLE[lp.sort.key] ? SORTABLE[lp.sort.key] : "createdAt";
  const sortDir = lp.sort?.dir === "asc" ? "asc" : "desc";
  try {
    const rows = await prisma.product.findMany({
      where,
      orderBy: { [sortKey]: sortDir },
      take: cap,
      select: {
        id: true,
        title: true,
        storeDomain: true,
        currentPrice: true,
        previousPrice: true,
        availability: true,
        metadataConfidence: true,
        lastCheckedAt: true,
        user: { select: { email: true } },
      },
    });
    const filtered =
      lp.params.changed === "yes"
        ? rows.filter(
            (r) =>
              r.currentPrice != null &&
              r.previousPrice != null &&
              r.currentPrice !== r.previousPrice,
          )
        : rows;
    return filtered.map((r) => ({
      id: r.id,
      title: r.title,
      storeDomain: r.storeDomain,
      userEmail: r.user?.email ?? "",
      currentPrice: r.currentPrice,
      availability: r.availability,
      metadataConfidence: r.metadataConfidence,
      lastCheckedAt: r.lastCheckedAt ? r.lastCheckedAt.toISOString() : null,
    }));
  } catch (e) {
    console.error("[ops] getProductsForExport:", e);
    return [];
  }
}
