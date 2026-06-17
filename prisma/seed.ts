import { PrismaClient } from "../src/generated/prisma";
import {
  getProductViews,
  mockAlerts,
  mockCart,
  mockCartItems,
  mockCollections,
  mockIntegrations,
  mockNotifications,
  mockPriceHistory,
  mockProducts,
  mockUser,
} from "../src/lib/mock-data";

const prisma = new PrismaClient();
const d = (s: string | null | undefined) => (s ? new Date(s) : null);

async function main() {
  console.log("Seeding UniKart database…");

  // Wipe (cascades from user) + global integrations
  await prisma.integrationAdapter.deleteMany();
  await prisma.user.deleteMany();

  // User
  await prisma.user.create({
    data: {
      id: mockUser.id,
      name: mockUser.name,
      email: mockUser.email,
      image: mockUser.image ?? null,
      plan: mockUser.plan,
      createdAt: d(mockUser.createdAt)!,
      updatedAt: d(mockUser.updatedAt)!,
    },
  });

  // Collections
  for (const c of mockCollections) {
    await prisma.collection.create({
      data: {
        id: c.id,
        userId: c.userId,
        name: c.name,
        icon: c.icon,
        sortOrder: c.sortOrder,
        createdAt: d(c.createdAt)!,
        updatedAt: d(c.updatedAt)!,
      },
    });
  }

  // Products
  for (const p of mockProducts) {
    await prisma.product.create({
      data: {
        id: p.id,
        userId: p.userId,
        title: p.title,
        description: p.description ?? null,
        originalUrl: p.originalUrl,
        canonicalUrl: p.canonicalUrl ?? null,
        imageUrl: p.imageUrl ?? null,
        storeName: p.storeName,
        storeDomain: p.storeDomain,
        brand: p.brand ?? null,
        sku: p.sku ?? null,
        category: p.category ?? null,
        currency: p.currency,
        currentPrice: p.currentPrice,
        previousPrice: p.previousPrice ?? null,
        lowestPrice: p.lowestPrice ?? null,
        highestPrice: p.highestPrice ?? null,
        availability: p.availability,
        metadataConfidence: p.metadataConfidence,
        notes: p.notes ?? null,
        isArchived: p.isArchived,
        isPurchased: p.isPurchased,
        purchasedAt: d(p.purchasedAt),
        releasedAt: d(p.releasedAt),
        createdAt: d(p.createdAt)!,
        updatedAt: d(p.updatedAt)!,
        lastCheckedAt: d(p.lastCheckedAt),
      },
    });
  }

  // Product ↔ Collection links (derived from the product views)
  for (const pv of getProductViews()) {
    for (const col of pv.collections) {
      await prisma.productCollection.create({
        data: { productId: pv.id, collectionId: col.id },
      });
    }
  }

  // Price snapshots
  for (const [productId, snaps] of Object.entries(mockPriceHistory)) {
    for (const s of snaps) {
      await prisma.priceSnapshot.create({
        data: {
          id: s.id,
          productId,
          price: s.price,
          currency: s.currency,
          source: s.source,
          checkedAt: d(s.checkedAt)!,
        },
      });
    }
  }

  // One stock snapshot per product (current availability)
  for (const p of mockProducts) {
    await prisma.stockSnapshot.create({
      data: {
        productId: p.id,
        availability: p.availability,
        source: "mock",
        checkedAt: d(p.lastCheckedAt ?? p.updatedAt)!,
      },
    });
  }

  // Alerts
  for (const a of mockAlerts) {
    await prisma.alertRule.create({
      data: {
        id: a.id,
        productId: a.productId,
        userId: a.userId,
        type: a.type,
        targetPrice: a.targetPrice ?? null,
        enabled: a.enabled,
        createdAt: d(a.createdAt)!,
        updatedAt: d(a.updatedAt)!,
      },
    });
  }

  // Cart + items
  await prisma.universalCart.create({
    data: {
      id: mockCart.id,
      userId: mockCart.userId,
      name: mockCart.name,
      status: mockCart.status,
      createdAt: d(mockCart.createdAt)!,
      updatedAt: d(mockCart.updatedAt)!,
    },
  });
  for (const it of mockCartItems) {
    await prisma.universalCartItem.create({
      data: {
        id: it.id,
        cartId: it.cartId,
        productId: it.productId,
        quantity: it.quantity,
        merchantStatus: it.merchantStatus,
        checkoutStatus: it.checkoutStatus,
        addedAt: d(it.addedAt)!,
        completedAt: d(it.completedAt),
      },
    });
  }

  // Notifications
  for (const n of mockNotifications) {
    await prisma.notification.create({
      data: {
        id: n.id,
        userId: n.userId,
        productId: n.productId ?? null,
        cartId: n.cartId ?? null,
        type: n.type,
        title: n.title,
        body: n.body,
        read: n.read,
        createdAt: d(n.createdAt)!,
      },
    });
  }

  // Integration adapters (global placeholders)
  for (const ia of mockIntegrations) {
    await prisma.integrationAdapter.create({
      data: {
        id: ia.id,
        name: ia.name,
        type: ia.type,
        enabled: ia.enabled,
        status: ia.status,
        description: ia.description,
        configJson: JSON.stringify(ia.configJson ?? {}),
        createdAt: d(ia.createdAt)!,
        updatedAt: d(ia.updatedAt)!,
      },
    });
  }

  const counts = {
    users: await prisma.user.count(),
    collections: await prisma.collection.count(),
    products: await prisma.product.count(),
    priceSnapshots: await prisma.priceSnapshot.count(),
    alerts: await prisma.alertRule.count(),
    cartItems: await prisma.universalCartItem.count(),
    notifications: await prisma.notification.count(),
    integrations: await prisma.integrationAdapter.count(),
  };
  console.log("Seed complete:", counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
