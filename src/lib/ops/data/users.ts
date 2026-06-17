/**
 * UniKart Ops — Users data access (list + detail).
 *
 * Server-only read layer for /ops/users and /ops/users/[id]. Builds the Prisma
 * where/orderBy/skip/take from URL list params (server-driven filter/sort/page —
 * never loads all rows into the browser), and assembles the per-user detail.
 *
 * HONESTY: every query is guarded by hasDatabase() and wrapped in try/catch,
 * returning a safe empty fallback on error (never fabricated data).
 *
 * SECURITY/PII: never selects Account.password, tokens, or any secret column.
 * Email is sensitive PII but allowed on the detail page (marked sensitive in the
 * UI). Card data does not exist in this schema and is never read.
 */
import { hasDatabase, prisma } from "../../db";
import type { ListParams } from "./common";

/* ---------------------------------------------------------------- list ---- */

export interface UserRow {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  plan: string;
  status: string;
  isTestAccount: boolean;
  isInternal: boolean;
  createdAt: string;
  lastActiveAt: string | null;
  productCount: number;
  collectionCount: number;
  cartItemCount: number;
  enabledAlertCount: number;
  openTicketCount: number;
}

export interface UsersResult {
  rows: UserRow[];
  total: number;
}

const SORTABLE: Record<string, string> = {
  createdAt: "createdAt",
  lastActiveAt: "lastActiveAt",
  productCount: "products", // sorted via _count relation below
};

/**
 * Filtered, sorted, paginated users. Reads q + role/plan/status from lp.params.
 * Search spans email, name, and id (case-insensitive on text columns).
 */
export async function getUsers(lp: ListParams): Promise<UsersResult> {
  const empty: UsersResult = { rows: [], total: 0 };
  if (!hasDatabase()) return empty;

  const where: Record<string, unknown> = {};

  if (lp.q) {
    where.OR = [
      { email: { contains: lp.q, mode: "insensitive" } },
      { name: { contains: lp.q, mode: "insensitive" } },
      { id: { equals: lp.q } },
    ];
  }

  const role = lp.params.role;
  if (role) where.role = role;

  const plan = lp.params.plan;
  if (plan) where.plan = plan;

  const status = lp.params.status;
  if (status) where.status = status;

  // Build orderBy. productCount sorts via the relation count; the others are
  // plain columns. Default: newest first.
  const dir = lp.sort?.dir === "asc" ? "asc" : "desc";
  let orderBy: Record<string, unknown>;
  const sortKey = lp.sort?.key && SORTABLE[lp.sort.key] ? lp.sort.key : "createdAt";
  if (sortKey === "productCount") {
    orderBy = { products: { _count: dir } };
  } else {
    orderBy = { [SORTABLE[sortKey]]: dir };
  }

  try {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy,
        skip: (lp.page - 1) * lp.pageSize,
        take: lp.pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          role: true,
          plan: true,
          status: true,
          isTestAccount: true,
          isInternal: true,
          createdAt: true,
          lastActiveAt: true,
          _count: {
            select: {
              products: true,
              collections: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const ids = users.map((u) => u.id);

    // Counts that need their own grouped queries (no direct _count relation on
    // the right shape): enabled alerts, cart items, open tickets.
    const [alertGroups, cartItemGroups, ticketGroups] = await Promise.all([
      ids.length
        ? prisma.alertRule.groupBy({
            by: ["userId"],
            where: { userId: { in: ids }, enabled: true },
            _count: { _all: true },
          })
        : Promise.resolve([] as { userId: string; _count: { _all: number } }[]),
      ids.length
        ? prisma.universalCartItem.groupBy({
            by: ["cartId"],
            where: { cart: { userId: { in: ids } } },
            _count: { _all: true },
          })
        : Promise.resolve([] as { cartId: string; _count: { _all: number } }[]),
      ids.length
        ? prisma.supportTicket.groupBy({
            by: ["userId"],
            where: { userId: { in: ids }, status: { in: ["open", "pending"] } },
            _count: { _all: true },
          })
        : Promise.resolve([] as { userId: string | null; _count: { _all: number } }[]),
    ]);

    const alertByUser = new Map<string, number>();
    for (const g of alertGroups) alertByUser.set(g.userId, g._count._all);

    const ticketByUser = new Map<string, number>();
    for (const g of ticketGroups) if (g.userId) ticketByUser.set(g.userId, g._count._all);

    // Cart items are grouped by cartId — roll them up to the owning user.
    const cartByUser = new Map<string, number>();
    if (cartItemGroups.length) {
      const cartIds = cartItemGroups.map((g) => g.cartId);
      const carts = await prisma.universalCart.findMany({
        where: { id: { in: cartIds } },
        select: { id: true, userId: true },
      });
      const userByCart = new Map(carts.map((c) => [c.id, c.userId]));
      for (const g of cartItemGroups) {
        const uid = userByCart.get(g.cartId);
        if (uid) cartByUser.set(uid, (cartByUser.get(uid) ?? 0) + g._count._all);
      }
    }

    const rows: UserRow[] = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image,
      role: u.role,
      plan: u.plan,
      status: u.status,
      isTestAccount: u.isTestAccount,
      isInternal: u.isInternal,
      createdAt: u.createdAt.toISOString(),
      lastActiveAt: u.lastActiveAt ? u.lastActiveAt.toISOString() : null,
      productCount: u._count.products,
      collectionCount: u._count.collections,
      cartItemCount: cartByUser.get(u.id) ?? 0,
      enabledAlertCount: alertByUser.get(u.id) ?? 0,
      openTicketCount: ticketByUser.get(u.id) ?? 0,
    }));

    return { rows, total };
  } catch (e) {
    console.error("[ops] getUsers:", e);
    return empty;
  }
}

/**
 * All rows matching the current filters, for CSV export. Capped to a sane limit
 * so a runaway export can't exhaust memory. Reuses the same where-building as
 * the list (minus pagination).
 */
export async function getUsersForExport(
  lp: ListParams,
  limit = 5000,
): Promise<UserRow[]> {
  if (!hasDatabase()) return [];
  const exportLp: ListParams = { ...lp, page: 1, pageSize: limit };
  const { rows } = await getUsers(exportLp);
  return rows;
}

/* -------------------------------------------------------------- detail ---- */

export interface UserDetail {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  plan: string;
  status: string;
  disabledAt: string | null;
  isTestAccount: boolean;
  isInternal: boolean;
  emailVerified: boolean;
  lastActiveAt: string | null;
  onboardingCompletedAt: string | null;
  createdAt: string;
  stripeCustomerId: string | null;
  counts: {
    products: number;
    collections: number;
    alerts: number;
    enabledAlerts: number;
    cartItems: number;
    notifications: number;
  };
  subscription: UserSubscription | null;
  collections: UserCollection[];
  cart: UserCartSummary | null;
  notifications: UserNotification[];
  events: UserEvent[];
  supportNotes: UserSupportNote[];
  dataRequests: UserDataRequest[];
}

export interface UserSubscription {
  plan: string;
  status: string;
  billingInterval: string | null;
  periodEnd: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export interface UserCollection {
  id: string;
  name: string;
  productCount: number;
}

export interface UserCartSummary {
  id: string;
  name: string;
  status: string;
  itemCount: number;
}

export interface UserNotification {
  id: string;
  type: string;
  title: string;
  read: boolean;
  createdAt: string;
}

export interface UserEvent {
  id: string;
  eventName: string;
  source: string;
  entityType: string | null;
  createdAt: string;
}

export interface UserSupportNote {
  id: string;
  body: string;
  visibility: string;
  adminUserId: string;
  createdAt: string;
}

export interface UserDataRequest {
  id: string;
  type: string;
  status: string;
  requestedById: string | null;
  reason: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** Full per-user detail, or null when the user doesn't exist / no DB. */
export async function getUserDetail(id: string): Promise<UserDetail | null> {
  if (!hasDatabase()) return null;

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        plan: true,
        status: true,
        disabledAt: true,
        isTestAccount: true,
        isInternal: true,
        emailVerified: true,
        lastActiveAt: true,
        onboardingCompletedAt: true,
        createdAt: true,
        stripeCustomerId: true,
        _count: {
          select: {
            products: true,
            collections: true,
            alerts: true,
            notifications: true,
          },
        },
      },
    });

    if (!user) return null;

    const [
      subscription,
      collections,
      cart,
      enabledAlerts,
      notifications,
      events,
      supportNotes,
      dataRequests,
    ] = await Promise.all([
      // Latest subscription (most recently ending / created). No card data exists.
      prisma.subscription.findFirst({
        where: { referenceId: id },
        orderBy: { periodEnd: "desc" },
        select: {
          plan: true,
          status: true,
          billingInterval: true,
          periodEnd: true,
          trialEnd: true,
          cancelAtPeriodEnd: true,
        },
      }),
      prisma.collection.findMany({
        where: { userId: id },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          _count: { select: { products: true } },
        },
        take: 50,
      }),
      prisma.universalCart.findFirst({
        where: { userId: id },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          name: true,
          status: true,
          _count: { select: { items: true } },
        },
      }),
      prisma.alertRule.count({ where: { userId: id, enabled: true } }),
      prisma.notification.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, type: true, title: true, read: true, createdAt: true },
      }),
      prisma.analyticsEvent.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 8,
        select: { id: true, eventName: true, source: true, entityType: true, createdAt: true },
      }),
      prisma.supportNote.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, body: true, visibility: true, adminUserId: true, createdAt: true },
      }),
      prisma.dataRequest.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          type: true,
          status: true,
          requestedById: true,
          reason: true,
          createdAt: true,
          completedAt: true,
        },
      }),
    ]);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      plan: user.plan,
      status: user.status,
      disabledAt: user.disabledAt ? user.disabledAt.toISOString() : null,
      isTestAccount: user.isTestAccount,
      isInternal: user.isInternal,
      emailVerified: user.emailVerified,
      lastActiveAt: user.lastActiveAt ? user.lastActiveAt.toISOString() : null,
      onboardingCompletedAt: user.onboardingCompletedAt
        ? user.onboardingCompletedAt.toISOString()
        : null,
      createdAt: user.createdAt.toISOString(),
      stripeCustomerId: user.stripeCustomerId,
      counts: {
        products: user._count.products,
        collections: user._count.collections,
        alerts: user._count.alerts,
        enabledAlerts,
        cartItems: cart?._count.items ?? 0,
        notifications: user._count.notifications,
      },
      subscription: subscription
        ? {
            plan: subscription.plan,
            status: subscription.status,
            billingInterval: subscription.billingInterval,
            periodEnd: subscription.periodEnd ? subscription.periodEnd.toISOString() : null,
            trialEnd: subscription.trialEnd ? subscription.trialEnd.toISOString() : null,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd ?? false,
          }
        : null,
      collections: collections.map((c) => ({
        id: c.id,
        name: c.name,
        productCount: c._count.products,
      })),
      cart: cart
        ? { id: cart.id, name: cart.name, status: cart.status, itemCount: cart._count.items }
        : null,
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      })),
      events: events.map((e) => ({
        id: e.id,
        eventName: e.eventName,
        source: e.source,
        entityType: e.entityType,
        createdAt: e.createdAt.toISOString(),
      })),
      supportNotes: supportNotes.map((s) => ({
        id: s.id,
        body: s.body,
        visibility: s.visibility,
        adminUserId: s.adminUserId,
        createdAt: s.createdAt.toISOString(),
      })),
      dataRequests: dataRequests.map((d) => ({
        id: d.id,
        type: d.type,
        status: d.status,
        requestedById: d.requestedById,
        reason: d.reason,
        createdAt: d.createdAt.toISOString(),
        completedAt: d.completedAt ? d.completedAt.toISOString() : null,
      })),
    };
  } catch (e) {
    console.error("[ops] getUserDetail:", e);
    return null;
  }
}
