/**
 * UniKart Ops — Support workspace data access.
 *
 * Reads SupportTicket + SupportNote for the support console. Server-only:
 * every query is guarded by hasDatabase() and wrapped in try/catch, returning a
 * safe fallback (empty list / zero counts) so the page renders even when the DB
 * is unreachable. No secrets or PII are selected beyond what the console needs
 * (subject, email, status). Email on a ticket is sensitive but allowed — pages
 * mark it sensitive via OpsKeyValue.
 */
import { hasDatabase, prisma } from "../../db";
import type { ListParams } from "./common";

/* ---- Enum-like unions (mirror the String columns in schema.prisma) ---- */

export const TICKET_STATUSES = ["open", "pending", "resolved", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_CATEGORIES = [
  "account",
  "product_saving",
  "parser_failure",
  "price_tracking",
  "stock_tracking",
  "billing",
  "privacy",
  "bug",
  "feedback",
  "other",
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

/** Human labels for categories (used in filters + detail copy). */
export const CATEGORY_LABELS: Record<string, string> = {
  account: "Account",
  product_saving: "Saving items",
  parser_failure: "Parser failure",
  price_tracking: "Price tracking",
  stock_tracking: "Stock tracking",
  billing: "Billing",
  privacy: "Privacy",
  bug: "Bug",
  feedback: "Feedback",
  other: "Other",
};

export function categoryLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return CATEGORY_LABELS[value] ?? value;
}

/* ---- View shapes ---- */

export interface TicketRow {
  id: string;
  subject: string;
  email: string;
  userId: string | null;
  status: string;
  priority: string;
  category: string;
  assignedToId: string | null;
  assignedToName: string | null;
  createdAt: string;
}

export interface SupportNoteView {
  id: string;
  body: string;
  visibility: string;
  adminUserId: string;
  adminName: string | null;
  adminEmail: string | null;
  createdAt: string;
}

export interface TicketDetail {
  id: string;
  subject: string;
  email: string;
  status: string;
  priority: string;
  category: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  productId: string | null;
  productTitle: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  notes: SupportNoteView[];
}

export interface SupportStats {
  open: number;
  pending: number;
  resolved: number;
  closed: number;
  total: number;
  unassignedOpen: number;
}

/* ---- Sorting ---- */

const SORTABLE: Record<string, string> = {
  createdAt: "createdAt",
  status: "status",
  priority: "priority",
};

/* ---- Queries ---- */

/**
 * Server-driven, filtered + paginated ticket list. Reads q (subject/email),
 * status, priority, and category from lp.params and builds the Prisma where /
 * orderBy / skip / take. Returns { rows, total }.
 */
export async function getTickets(
  lp: ListParams,
): Promise<{ rows: TicketRow[]; total: number }> {
  if (!hasDatabase()) return { rows: [], total: 0 };

  const where: Record<string, unknown> = {};
  if (lp.q) {
    where.OR = [
      { subject: { contains: lp.q, mode: "insensitive" } },
      { email: { contains: lp.q, mode: "insensitive" } },
    ];
  }
  const status = lp.params.status;
  if (status && (TICKET_STATUSES as readonly string[]).includes(status)) {
    where.status = status;
  }
  const priority = lp.params.priority;
  if (priority && (TICKET_PRIORITIES as readonly string[]).includes(priority)) {
    where.priority = priority;
  }
  const category = lp.params.category;
  if (category && (TICKET_CATEGORIES as readonly string[]).includes(category)) {
    where.category = category;
  }

  const sortKey = lp.sort ? SORTABLE[lp.sort.key] : undefined;
  const orderBy = sortKey
    ? { [sortKey]: lp.sort!.dir }
    : { createdAt: "desc" as const };

  try {
    const [rows, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where,
        orderBy,
        skip: (lp.page - 1) * lp.pageSize,
        take: lp.pageSize,
        select: {
          id: true,
          subject: true,
          email: true,
          userId: true,
          status: true,
          priority: true,
          category: true,
          assignedToId: true,
          createdAt: true,
        },
      }),
      prisma.supportTicket.count({ where }),
    ]);

    // Resolve assignee names in one extra query (no relation on assignedToId).
    const assigneeIds = [
      ...new Set(rows.map((r) => r.assignedToId).filter((x): x is string => !!x)),
    ];
    const assignees = assigneeIds.length
      ? await prisma.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(assignees.map((a) => [a.id, a.name]));

    return {
      rows: rows.map((r) => ({
        id: r.id,
        subject: r.subject,
        email: r.email,
        userId: r.userId,
        status: r.status,
        priority: r.priority,
        category: r.category,
        assignedToId: r.assignedToId,
        assignedToName: r.assignedToId ? nameById.get(r.assignedToId) ?? null : null,
        createdAt: r.createdAt.toISOString(),
      })),
      total,
    };
  } catch (e) {
    console.error("[ops] getTickets:", e);
    return { rows: [], total: 0 };
  }
}

/** Full ticket with its linked user, product, assignee, and note thread. */
export async function getTicketDetail(id: string): Promise<TicketDetail | null> {
  if (!hasDatabase()) return null;
  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id },
      select: {
        id: true,
        subject: true,
        email: true,
        status: true,
        priority: true,
        category: true,
        userId: true,
        productId: true,
        assignedToId: true,
        createdAt: true,
        updatedAt: true,
        closedAt: true,
        notes: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            body: true,
            visibility: true,
            adminUserId: true,
            createdAt: true,
          },
        },
      },
    });
    if (!ticket) return null;

    // Resolve linked user, product, assignee, and note authors with small lookups.
    const adminIds = [
      ...new Set(ticket.notes.map((n) => n.adminUserId).filter(Boolean)),
    ];
    const lookupUserIds = [
      ...new Set(
        [ticket.userId, ticket.assignedToId, ...adminIds].filter(
          (x): x is string => !!x,
        ),
      ),
    ];

    const [users, product] = await Promise.all([
      lookupUserIds.length
        ? prisma.user.findMany({
            where: { id: { in: lookupUserIds } },
            select: { id: true, name: true, email: true },
          })
        : Promise.resolve([]),
      ticket.productId
        ? prisma.product.findUnique({
            where: { id: ticket.productId },
            select: { id: true, title: true },
          })
        : Promise.resolve(null),
    ]);

    const userById = new Map(users.map((u) => [u.id, u]));
    const linkedUser = ticket.userId ? userById.get(ticket.userId) ?? null : null;
    const assignee = ticket.assignedToId
      ? userById.get(ticket.assignedToId) ?? null
      : null;

    return {
      id: ticket.id,
      subject: ticket.subject,
      email: ticket.email,
      status: ticket.status,
      priority: ticket.priority,
      category: ticket.category,
      userId: ticket.userId,
      userName: linkedUser?.name ?? null,
      userEmail: linkedUser?.email ?? null,
      productId: ticket.productId,
      productTitle: product?.title ?? null,
      assignedToId: ticket.assignedToId,
      assignedToName: assignee?.name ?? null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      closedAt: ticket.closedAt ? ticket.closedAt.toISOString() : null,
      notes: ticket.notes.map((n) => {
        const author = userById.get(n.adminUserId) ?? null;
        return {
          id: n.id,
          body: n.body,
          visibility: n.visibility,
          adminUserId: n.adminUserId,
          adminName: author?.name ?? null,
          adminEmail: author?.email ?? null,
          createdAt: n.createdAt.toISOString(),
        };
      }),
    };
  } catch (e) {
    console.error("[ops] getTicketDetail:", e);
    return null;
  }
}

/** Counts by status for the metric cards. Safe zeros on error / no DB. */
export async function getSupportStats(): Promise<SupportStats> {
  const empty: SupportStats = {
    open: 0,
    pending: 0,
    resolved: 0,
    closed: 0,
    total: 0,
    unassignedOpen: 0,
  };
  if (!hasDatabase()) return empty;
  try {
    const [grouped, total, unassignedOpen] = await Promise.all([
      prisma.supportTicket.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.supportTicket.count(),
      prisma.supportTicket.count({
        where: { status: "open", assignedToId: null },
      }),
    ]);

    const byStatus = new Map(
      grouped.map((g) => [g.status, g._count._all]),
    );
    return {
      open: byStatus.get("open") ?? 0,
      pending: byStatus.get("pending") ?? 0,
      resolved: byStatus.get("resolved") ?? 0,
      closed: byStatus.get("closed") ?? 0,
      total,
      unassignedOpen,
    };
  } catch (e) {
    console.error("[ops] getSupportStats:", e);
    return empty;
  }
}

/**
 * Ops operators who can be assigned tickets (non-customer roles). Used to
 * populate the "assign" picker. Returns a small list; safe empty on error.
 */
export async function getAssignableOperators(): Promise<
  { id: string; name: string; email: string; role: string }[]
> {
  if (!hasDatabase()) return [];
  try {
    const rows = await prisma.user.findMany({
      where: {
        status: "active",
        role: { in: ["OWNER", "ADMIN", "SUPPORT", "FINANCE", "READONLY"] },
      },
      orderBy: { name: "asc" },
      take: 100,
      select: { id: true, name: true, email: true, role: true },
    });
    return rows;
  } catch (e) {
    console.error("[ops] getAssignableOperators:", e);
    return [];
  }
}
