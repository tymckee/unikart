import type {
  AlertRule,
  CheckoutStep,
  Collection,
  IntegrationAdapter,
  Notification,
  PriceSnapshot,
  Product,
  ProductView,
  UniversalCart,
  UniversalCartItem,
  User,
} from "./types";

/* ============================================================
   UniKart — Mock data
   Fully deterministic (no Date.now / Math.random) so server and
   client render identically. Replaced by Prisma + parser later.
   ============================================================ */

/** Fixed clock so relative times are stable across SSR/CSR. */
export const NOW = new Date("2026-06-16T12:00:00Z").getTime();

const DAY = 86_400_000;
const HOUR = 3_600_000;

function daysAgo(n: number): string {
  return new Date(NOW - n * DAY).toISOString();
}
function hoursAgo(n: number): string {
  return new Date(NOW - n * HOUR).toISOString();
}

/** Deterministic price series ending at `current`, starting near `high`. */
function series(
  seed: string,
  points: number,
  high: number,
  current: number,
): PriceSnapshot[] {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = (h * 33) ^ seed.charCodeAt(i);
  const out: PriceSnapshot[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const wobble = Math.sin((i + (h % 7)) * 1.3) * (high * 0.025);
    const base = high + (current - high) * t;
    const price =
      i === points - 1 ? current : Math.max(0, Math.round((base + wobble) * 100) / 100);
    out.push({
      id: `${seed}-snap-${i}`,
      productId: seed,
      price,
      currency: "USD",
      source: "mock",
      checkedAt: daysAgo((points - 1 - i) * 4),
    });
  }
  return out;
}

export const mockUser: User = {
  id: "user_1",
  name: "Tyler",
  email: "you@uni-kart.com",
  image: null,
  plan: "pro",
  createdAt: daysAgo(120),
  updatedAt: daysAgo(1),
};

export const mockCollections: Collection[] = [
  { id: "col_tech", userId: "user_1", name: "Tech", icon: "cpu", sortOrder: 0, createdAt: daysAgo(90), updatedAt: daysAgo(2) },
  { id: "col_home", userId: "user_1", name: "Home", icon: "home", sortOrder: 1, createdAt: daysAgo(88), updatedAt: daysAgo(5) },
  { id: "col_apartment", userId: "user_1", name: "Apartment", icon: "lamp", sortOrder: 2, createdAt: daysAgo(70), updatedAt: daysAgo(6) },
  { id: "col_clothing", userId: "user_1", name: "Clothing", icon: "shirt", sortOrder: 3, createdAt: daysAgo(60), updatedAt: daysAgo(9) },
  { id: "col_gifts", userId: "user_1", name: "Gifts", icon: "gift", sortOrder: 4, createdAt: daysAgo(40), updatedAt: daysAgo(3) },
  { id: "col_work", userId: "user_1", name: "Work", icon: "briefcase", sortOrder: 5, createdAt: daysAgo(38), updatedAt: daysAgo(12) },
  { id: "col_travel", userId: "user_1", name: "Travel", icon: "plane", sortOrder: 6, createdAt: daysAgo(30), updatedAt: daysAgo(7) },
  { id: "col_later", userId: "user_1", name: "Later", icon: "clock", sortOrder: 7, createdAt: daysAgo(20), updatedAt: daysAgo(4) },
];

interface Seed {
  id: string;
  title: string;
  brand: string;
  storeDomain: string;
  storeName: string;
  category: string;
  current: number;
  previous?: number;
  high: number;
  low: number;
  availability: Product["availability"];
  confidence: Product["metadataConfidence"];
  collections: string[];
  notes?: string;
  archived?: boolean;
  purchased?: boolean;
  url: string;
  description: string;
}

const seeds: Seed[] = [
  {
    id: "p_airpods_max",
    title: "AirPods Max — USB-C",
    brand: "Apple",
    storeDomain: "apple.com",
    storeName: "Apple",
    category: "Headphones",
    current: 549,
    previous: 549,
    high: 549,
    low: 479,
    availability: "in_stock",
    confidence: "high",
    collections: ["col_tech"],
    url: "https://www.apple.com/airpods-max/",
    description:
      "Over-ear headphones with active noise cancellation, spatial audio, and a USB-C connector.",
  },
  {
    id: "p_sony_xm5",
    title: "Sony WH-1000XM5 Wireless Headphones",
    brand: "Sony",
    storeDomain: "amazon.com",
    storeName: "Amazon",
    category: "Headphones",
    current: 328,
    previous: 399,
    high: 399,
    low: 318,
    availability: "in_stock",
    confidence: "medium",
    collections: ["col_tech"],
    notes: "Compare against AirPods Max for travel.",
    url: "https://www.amazon.com/dp/B09XS7JWHH",
    description:
      "Industry-leading noise cancellation with 30-hour battery and multipoint connection.",
  },
  {
    id: "p_dyson_v15",
    title: "Dyson V15 Detect Cordless Vacuum",
    brand: "Dyson",
    storeDomain: "dyson.com",
    storeName: "Dyson",
    category: "Home",
    current: 649,
    previous: 749,
    high: 749,
    low: 599,
    availability: "in_stock",
    confidence: "high",
    collections: ["col_home", "col_apartment"],
    url: "https://www.dyson.com/vacuum-cleaners/cordless/v15/detect",
    description:
      "Laser dust detection, HEPA filtration, and an LCD screen that counts particle size.",
  },
  {
    id: "p_lecreuset",
    title: "Le Creuset Round Dutch Oven, 5.5 qt",
    brand: "Le Creuset",
    storeDomain: "lecreuset.com",
    storeName: "Le Creuset",
    category: "Kitchen",
    current: 380,
    previous: 420,
    high: 435,
    low: 360,
    availability: "low_stock",
    confidence: "high",
    collections: ["col_apartment", "col_home"],
    url: "https://www.lecreuset.com/round-dutch-oven/LS2501.html",
    description:
      "Enameled cast iron Dutch oven for braising, baking, and slow cooking. Color: Sea Salt.",
  },
  {
    id: "p_aeron",
    title: "Herman Miller Aeron Chair",
    brand: "Herman Miller",
    storeDomain: "hermanmiller.com",
    storeName: "Herman Miller",
    category: "Office",
    current: 1395,
    previous: 1445,
    high: 1495,
    low: 1295,
    availability: "in_stock",
    confidence: "medium",
    collections: ["col_work", "col_home"],
    url: "https://www.hermanmiller.com/products/seating/office-chairs/aeron-chairs/",
    description:
      "Ergonomic office chair with PostureFit SL and 8Z Pellicle suspension. Size B, Graphite.",
  },
  {
    id: "p_switch2",
    title: "Nintendo Switch 2 Console",
    brand: "Nintendo",
    storeDomain: "bestbuy.com",
    storeName: "Best Buy",
    category: "Gaming",
    current: 449,
    previous: 449,
    high: 449,
    low: 449,
    availability: "out_of_stock",
    confidence: "high",
    collections: ["col_gifts"],
    url: "https://www.bestbuy.com/site/nintendo-switch-2/",
    description: "Next-generation hybrid console with a larger display and upgraded dock.",
  },
  {
    id: "p_patagonia",
    title: "Patagonia Better Sweater Fleece Jacket",
    brand: "Patagonia",
    storeDomain: "patagonia.com",
    storeName: "Patagonia",
    category: "Apparel",
    current: 99,
    previous: 99,
    high: 99,
    low: 79,
    availability: "low_stock",
    confidence: "high",
    collections: ["col_clothing"],
    url: "https://www.patagonia.com/product/mens-better-sweater-fleece-jacket/",
    description: "Warm, knit fleece jacket made with recycled polyester. Color: Stonewash.",
  },
  {
    id: "p_lego_arch",
    title: "LEGO Architecture Himeji Castle",
    brand: "LEGO",
    storeDomain: "lego.com",
    storeName: "LEGO",
    category: "Toys",
    current: 229,
    previous: 199,
    high: 229,
    low: 199,
    availability: "in_stock",
    confidence: "high",
    collections: ["col_gifts"],
    url: "https://www.lego.com/en-us/product/himeji-castle-21060",
    description: "2,125-piece display model of the iconic Japanese castle.",
  },
  {
    id: "p_kindle",
    title: "Kindle Paperwhite (16 GB)",
    brand: "Amazon",
    storeDomain: "amazon.com",
    storeName: "Amazon",
    category: "E-reader",
    current: 159,
    previous: 159,
    high: 159,
    low: 119,
    availability: "in_stock",
    confidence: "medium",
    collections: ["col_later", "col_tech"],
    url: "https://www.amazon.com/dp/B0CFPJYX7P",
    description: "6.8-inch glare-free display, adjustable warm light, weeks of battery.",
  },
  {
    id: "p_peakdesign",
    title: "Peak Design Travel Backpack 45L",
    brand: "Peak Design",
    storeDomain: "peakdesign.com",
    storeName: "Peak Design",
    category: "Travel",
    current: 289.95,
    previous: 289.95,
    high: 299.95,
    low: 259.95,
    availability: "in_stock",
    confidence: "high",
    collections: ["col_travel", "col_work"],
    url: "https://www.peakdesign.com/products/travel-backpack",
    description: "Expandable 45L carry-on with weatherproof shell and modular packing.",
  },
  {
    id: "p_hydroflask",
    title: "Hydro Flask 32 oz Wide Mouth",
    brand: "Hydro Flask",
    storeDomain: "rei.com",
    storeName: "REI",
    category: "Travel",
    current: 44.95,
    previous: 49.95,
    high: 49.95,
    low: 39.95,
    availability: "in_stock",
    confidence: "low",
    collections: ["col_travel"],
    url: "https://www.rei.com/product/hydro-flask-32-wide-mouth",
    description: "Insulated stainless steel bottle. TempShield keeps drinks cold 24h.",
  },
  {
    id: "p_allbirds",
    title: "Allbirds Wool Runners",
    brand: "Allbirds",
    storeDomain: "allbirds.com",
    storeName: "Allbirds",
    category: "Footwear",
    current: 110,
    previous: 110,
    high: 110,
    low: 95,
    availability: "in_stock",
    confidence: "high",
    collections: ["col_clothing"],
    purchased: true,
    url: "https://www.allbirds.com/products/mens-wool-runners",
    description: "Everyday sneakers made from ZQ merino wool. Color: Natural Grey.",
  },
];

export const mockProducts: Product[] = seeds.map((s) => ({
  id: s.id,
  userId: "user_1",
  title: s.title,
  description: s.description,
  originalUrl: s.url,
  canonicalUrl: s.url,
  imageUrl: null, // populated by the parser later; UI renders a branded tile
  storeName: s.storeName,
  storeDomain: s.storeDomain,
  brand: s.brand,
  sku: null,
  category: s.category,
  currency: "USD",
  currentPrice: s.current,
  previousPrice: s.previous ?? null,
  lowestPrice: s.low,
  highestPrice: s.high,
  availability: s.availability,
  metadataConfidence: s.confidence,
  notes: s.notes ?? null,
  isArchived: s.archived ?? false,
  isPurchased: s.purchased ?? false,
  purchasedAt: s.purchased ? daysAgo(14) : null,
  createdAt: daysAgo(45 - seeds.indexOf(s) * 3),
  updatedAt: hoursAgo(seeds.indexOf(s) * 5 + 2),
  lastCheckedAt: hoursAgo(seeds.indexOf(s) + 1),
}));

export const mockPriceHistory: Record<string, PriceSnapshot[]> = Object.fromEntries(
  seeds.map((s) => [s.id, series(s.id, 12, s.high, s.current)]),
);

const productCollections: Record<string, string[]> = Object.fromEntries(
  seeds.map((s) => [s.id, s.collections]),
);

export const mockAlerts: AlertRule[] = [
  { id: "al_1", productId: "p_sony_xm5", userId: "user_1", type: "target_price", targetPrice: 300, enabled: true, createdAt: daysAgo(20), updatedAt: daysAgo(2) },
  { id: "al_2", productId: "p_dyson_v15", userId: "user_1", type: "target_price", targetPrice: 600, enabled: true, createdAt: daysAgo(15), updatedAt: daysAgo(3) },
  { id: "al_3", productId: "p_switch2", userId: "user_1", type: "back_in_stock", targetPrice: null, enabled: true, createdAt: daysAgo(10), updatedAt: daysAgo(1) },
  { id: "al_4", productId: "p_airpods_max", userId: "user_1", type: "price_drop", targetPrice: null, enabled: true, createdAt: daysAgo(30), updatedAt: daysAgo(5) },
  { id: "al_5", productId: "p_lecreuset", userId: "user_1", type: "target_price", targetPrice: 350, enabled: true, createdAt: daysAgo(8), updatedAt: daysAgo(2) },
];

const alertByProduct: Record<string, AlertRule> = Object.fromEntries(
  mockAlerts.map((a) => [a.productId, a]),
);

/* ---- Universal Cart ---- */

export const mockCart: UniversalCart = {
  id: "cart_1",
  userId: "user_1",
  name: "Universal Cart",
  status: "active",
  createdAt: daysAgo(6),
  updatedAt: hoursAgo(3),
};

export const mockCartItems: UniversalCartItem[] = [
  { id: "ci_1", cartId: "cart_1", productId: "p_sony_xm5", quantity: 1, merchantStatus: "in_stock", checkoutStatus: "ready", addedAt: daysAgo(5) },
  { id: "ci_2", cartId: "cart_1", productId: "p_kindle", quantity: 1, merchantStatus: "in_stock", checkoutStatus: "ready", addedAt: daysAgo(4) },
  { id: "ci_3", cartId: "cart_1", productId: "p_lecreuset", quantity: 1, merchantStatus: "low_stock", checkoutStatus: "ready", addedAt: daysAgo(3) },
  { id: "ci_4", cartId: "cart_1", productId: "p_airpods_max", quantity: 1, merchantStatus: "in_stock", checkoutStatus: "ready", addedAt: daysAgo(2) },
];

const cartProductIds = new Set(mockCartItems.map((i) => i.productId));

/** Group cart items by merchant into checkout steps. */
export const mockCheckoutSteps: CheckoutStep[] = (() => {
  const byDomain = new Map<string, UniversalCartItem[]>();
  for (const item of mockCartItems) {
    const p = mockProducts.find((x) => x.id === item.productId)!;
    const arr = byDomain.get(p.storeDomain) ?? [];
    arr.push(item);
    byDomain.set(p.storeDomain, arr);
  }
  return [...byDomain.entries()].map(([domain, items], idx) => {
    const first = mockProducts.find((x) => x.id === items[0].productId)!;
    const subtotal = items.reduce((s, it) => {
      const p = mockProducts.find((x) => x.id === it.productId)!;
      return s + (p.currentPrice ?? 0) * it.quantity;
    }, 0);
    return {
      id: `step_${idx + 1}`,
      cartId: "cart_1",
      storeDomain: domain,
      storeName: first.storeName,
      status: "pending" as const,
      estimatedSubtotal: Math.round(subtotal * 100) / 100,
      currency: "USD",
      checkoutUrl: null,
      itemIds: items.map((i) => i.id),
    };
  });
})();

/* ---- Notifications ---- */

export const mockNotifications: Notification[] = [
  { id: "n_1", userId: "user_1", productId: "p_sony_xm5", type: "price_dropped", title: "Price dropped on Sony WH-1000XM5", body: "Now $328 — down $71 (18%) from $399.", read: false, createdAt: hoursAgo(3) },
  { id: "n_2", userId: "user_1", productId: "p_dyson_v15", type: "price_dropped", title: "Dyson V15 Detect dropped", body: "Now $649, down from $749. $49 above your $600 target.", read: false, createdAt: hoursAgo(9) },
  { id: "n_3", userId: "user_1", productId: "p_hydroflask", type: "back_in_stock", title: "Back in stock: Hydro Flask 32 oz", body: "Available again at REI for $44.95.", read: false, createdAt: hoursAgo(26) },
  { id: "n_4", userId: "user_1", productId: "p_switch2", type: "out_of_stock", title: "Out of stock: Nintendo Switch 2", body: "Sold out at Best Buy. We'll alert you when it returns.", read: true, createdAt: daysAgo(2) },
  { id: "n_5", userId: "user_1", productId: "p_lego_arch", type: "price_increased", title: "Price increased on LEGO Himeji Castle", body: "Up $30 to $229. Above its recent average.", read: true, createdAt: daysAgo(3) },
  { id: "n_6", userId: "user_1", cartId: "cart_1", type: "cart_reminder", title: "4 items waiting in your Universal Cart", body: "Estimated total $1,036.95 across 3 stores.", read: true, createdAt: daysAgo(4) },
  { id: "n_7", userId: "user_1", productId: "p_lecreuset", type: "target_reached", title: "Almost at target: Le Creuset Dutch Oven", body: "Now $380. $30 above your $350 target.", read: true, createdAt: daysAgo(5) },
];

/* ---- Integration adapters (placeholders, no real partnerships) ---- */

export const mockIntegrations: IntegrationAdapter[] = [
  { id: "int_shopify", name: "Shopify Storefront", type: "merchant", enabled: false, status: "planned", description: "Resolve live checkoutUrl and cart for Shopify-powered stores.", configJson: {}, createdAt: daysAgo(30), updatedAt: daysAgo(30) },
  { id: "int_stripe", name: "Stripe", type: "payment", enabled: false, status: "planned", description: "Saved payment methods for faster guided checkout.", configJson: {}, createdAt: daysAgo(30), updatedAt: daysAgo(30) },
  { id: "int_bnpl", name: "BNPL Partner", type: "bnpl", enabled: false, status: "planned", description: "Pay-over-time options at checkout (partner to be announced).", configJson: {}, createdAt: daysAgo(30), updatedAt: daysAgo(30) },
  { id: "int_acp", name: "Agentic Commerce (ACP)", type: "agentic", enabled: false, status: "planned", description: "Agent-driven checkout once an open commerce protocol is available.", configJson: {}, createdAt: daysAgo(30), updatedAt: daysAgo(30) },
];

/* ============================================================
   Selectors — the UI reads through these so swapping to a real
   data source later is a one-file change.
   ============================================================ */

const collectionsById = new Map(mockCollections.map((c) => [c.id, c]));

export function buildProductView(p: Product): ProductView {
  return {
    ...p,
    collections: (productCollections[p.id] ?? [])
      .map((id) => collectionsById.get(id))
      .filter((c): c is Collection => Boolean(c)),
    priceHistory: mockPriceHistory[p.id] ?? [],
    alert: alertByProduct[p.id] ?? null,
    inCart: cartProductIds.has(p.id),
  };
}

export function getProductViews(): ProductView[] {
  return mockProducts.map(buildProductView);
}

export function getProductView(id: string): ProductView | undefined {
  const p = mockProducts.find((x) => x.id === id);
  return p ? buildProductView(p) : undefined;
}

export function getCollectionsWithCounts() {
  return mockCollections.map((c) => ({
    ...c,
    count: Object.values(productCollections).filter((ids) => ids.includes(c.id))
      .length,
  }));
}

export function getCartView() {
  const items = mockCartItems.map((item) => ({
    item,
    product: buildProductView(
      mockProducts.find((p) => p.id === item.productId)!,
    ),
  }));
  const total = items.reduce(
    (s, { item, product }) => s + (product.currentPrice ?? 0) * item.quantity,
    0,
  );
  return { cart: mockCart, items, steps: mockCheckoutSteps, total };
}

export function getUnreadCount(): number {
  return mockNotifications.filter((n) => !n.read).length;
}
