"use server";

/**
 * UniKart Ops — Support workspace server actions.
 *
 * Every mutation (1) gates via requireOpsPermission, (2) writes an audit row via
 * recordAdminAudit with actor: gate.viewer, (3) revalidates the affected paths,
 * and (4) returns an OpsActionResult. These are internal-tooling actions only:
 * UniKart does NOT send customer emails from here. Any "reply to the customer"
 * is recorded as a note and sent manually for now — see the inline notes and the
 * UI banner on the detail page.
 */
import { revalidatePath } from "next/cache";
import { prisma, hasDatabase } from "@/lib/db";
import { requireOpsPermission } from "@/lib/ops/guard";
import { recordAdminAudit } from "@/lib/ops/audit";
import { recordJobRun } from "@/lib/ops/jobs";
import type { OpsActionResult } from "@/lib/ops/types";
import {
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  TICKET_CATEGORIES,
} from "@/lib/ops/data/support";

const SUPPORT_PATH = "/ops/support";
function ticketPath(id: string): string {
  return SUPPORT_PATH + "/" + id;
}

/* ---- validation helpers ---- */

function isStatus(v: string): boolean {
  return (TICKET_STATUSES as readonly string[]).includes(v);
}
function isPriority(v: string): boolean {
  return (TICKET_PRIORITIES as readonly string[]).includes(v);
}
function isCategory(v: string): boolean {
  return (TICKET_CATEGORIES as readonly string[]).includes(v);
}
function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/* ---- createTicket ---- */

export interface CreateTicketInput {
  email: string;
  subject: string;
  category: string;
  priority: string;
  userId?: string;
}

/** Open a ticket on a customer's behalf (e.g. logged from an email or call). */
export async function createTicket(
  input: CreateTicketInput,
): Promise<OpsActionResult<{ id: string }>> {
  const gate = await requireOpsPermission("support.write");
  if (!gate.ok || !("viewer" in gate)) return gate;
  if (!hasDatabase()) return { ok: false, reason: "no-db" };

  const email = input.email.trim().toLowerCase();
  const subject = input.subject.trim();
  const category = isCategory(input.category) ? input.category : "other";
  const priority = isPriority(input.priority) ? input.priority : "normal";

  if (!isEmail(email)) {
    return { ok: false, reason: "invalid", message: "Enter a valid email address." };
  }
  if (subject.length < 3) {
    return { ok: false, reason: "invalid", message: "Add a short subject." };
  }

  try {
    // If a userId is supplied, only link it when it points at a real user.
    let userId: string | null = null;
    if (input.userId) {
      const user = await prisma.user.findUnique({
        where: { id: input.userId },
        select: { id: true },
      });
      userId = user?.id ?? null;
    }

    const ticket = await prisma.supportTicket.create({
      data: { email, subject, category, priority, userId, status: "open" },
      select: { id: true },
    });

    await recordAdminAudit({
      actor: gate.viewer,
      action: "support.ticket.create",
      targetType: "support_ticket",
      targetId: ticket.id,
      targetUserId: userId,
      after: { email, subject, category, priority, status: "open" },
    });

    revalidatePath(SUPPORT_PATH);
    return { ok: true, data: { id: ticket.id }, message: "Ticket opened." };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}

/* ---- addNote ---- */

/**
 * Add a note to a ticket. visibility "internal" is a private team note;
 * "customer" records a reply you intend to send — but email is NOT integrated,
 * so customer replies are sent manually for now (the note is the record).
 */
export async function addNote(
  ticketId: string,
  body: string,
  visibility: "internal" | "customer",
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("support.write");
  if (!gate.ok || !("viewer" in gate)) return gate;
  if (!hasDatabase()) return { ok: false, reason: "no-db" };

  const text = body.trim();
  if (text.length < 1) {
    return { ok: false, reason: "invalid", message: "Add some text to the note." };
  }
  const vis = visibility === "customer" ? "customer" : "internal";

  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, userId: true },
    });
    if (!ticket) return { ok: false, reason: "not-found", message: "Ticket not found." };

    await prisma.supportNote.create({
      data: {
        ticketId: ticket.id,
        userId: ticket.userId,
        adminUserId: gate.viewer.id,
        body: text,
        visibility: vis,
      },
    });
    // Touch the ticket so updatedAt reflects the latest activity.
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { updatedAt: new Date() },
    });

    await recordAdminAudit({
      actor: gate.viewer,
      action: "support.note.add",
      targetType: "support_ticket",
      targetId: ticket.id,
      targetUserId: ticket.userId,
      metadata: { visibility: vis },
    });

    revalidatePath(ticketPath(ticketId));
    return {
      ok: true,
      message:
        vis === "customer"
          ? "Note saved. Send the reply to the customer manually for now."
          : "Note added.",
    };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}

/* ---- setStatus ---- */

/** Move a ticket's status. Closing or resolving stamps closedAt. */
export async function setStatus(
  ticketId: string,
  status: string,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("support.write");
  if (!gate.ok || !("viewer" in gate)) return gate;
  if (!hasDatabase()) return { ok: false, reason: "no-db" };
  if (!isStatus(status)) {
    return { ok: false, reason: "invalid", message: "Unknown status." };
  }

  try {
    const before = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { status: true, userId: true },
    });
    if (!before) return { ok: false, reason: "not-found", message: "Ticket not found." };

    const isTerminal = status === "closed" || status === "resolved";
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: {
        status,
        closedAt: isTerminal ? new Date() : null,
      },
    });

    await recordAdminAudit({
      actor: gate.viewer,
      action: "support.ticket.status",
      targetType: "support_ticket",
      targetId: ticketId,
      targetUserId: before.userId,
      before: { status: before.status },
      after: { status },
    });

    revalidatePath(SUPPORT_PATH);
    revalidatePath(ticketPath(ticketId));
    return { ok: true, message: "Status updated." };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}

/* ---- assignTicket ---- */

/** Assign (or, with empty id, unassign) a ticket to an operator. */
export async function assignTicket(
  ticketId: string,
  assignedToId: string,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("support.write");
  if (!gate.ok || !("viewer" in gate)) return gate;
  if (!hasDatabase()) return { ok: false, reason: "no-db" };

  try {
    const before = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { assignedToId: true, userId: true },
    });
    if (!before) return { ok: false, reason: "not-found", message: "Ticket not found." };

    let nextId: string | null = null;
    if (assignedToId) {
      const operator = await prisma.user.findUnique({
        where: { id: assignedToId },
        select: { id: true },
      });
      if (!operator) {
        return { ok: false, reason: "invalid", message: "Unknown operator." };
      }
      nextId = operator.id;
    }

    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { assignedToId: nextId },
    });

    await recordAdminAudit({
      actor: gate.viewer,
      action: "support.ticket.assign",
      targetType: "support_ticket",
      targetId: ticketId,
      targetUserId: before.userId,
      before: { assignedToId: before.assignedToId },
      after: { assignedToId: nextId },
    });

    revalidatePath(SUPPORT_PATH);
    revalidatePath(ticketPath(ticketId));
    return { ok: true, message: nextId ? "Ticket assigned." : "Ticket unassigned." };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}

/* ---- linkTicket ---- */

/** Link a ticket to a user and/or a product (only when they exist). */
export async function linkTicket(
  ticketId: string,
  links: { userId?: string; productId?: string },
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("support.write");
  if (!gate.ok || !("viewer" in gate)) return gate;
  if (!hasDatabase()) return { ok: false, reason: "no-db" };

  try {
    const before = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { userId: true, productId: true },
    });
    if (!before) return { ok: false, reason: "not-found", message: "Ticket not found." };

    const data: { userId?: string | null; productId?: string | null } = {};

    if (links.userId !== undefined) {
      const trimmed = links.userId.trim();
      if (!trimmed) {
        data.userId = null;
      } else {
        const user = await prisma.user.findUnique({
          where: { id: trimmed },
          select: { id: true },
        });
        if (!user) {
          return { ok: false, reason: "invalid", message: "No user with that id." };
        }
        data.userId = user.id;
      }
    }

    if (links.productId !== undefined) {
      const trimmed = links.productId.trim();
      if (!trimmed) {
        data.productId = null;
      } else {
        const product = await prisma.product.findUnique({
          where: { id: trimmed },
          select: { id: true },
        });
        if (!product) {
          return { ok: false, reason: "invalid", message: "No product with that id." };
        }
        data.productId = product.id;
      }
    }

    if (Object.keys(data).length === 0) {
      return { ok: false, reason: "invalid", message: "Nothing to link." };
    }

    await prisma.supportTicket.update({ where: { id: ticketId }, data });

    await recordAdminAudit({
      actor: gate.viewer,
      action: "support.ticket.link",
      targetType: "support_ticket",
      targetId: ticketId,
      targetUserId: data.userId ?? before.userId,
      before: { userId: before.userId, productId: before.productId },
      after: data,
    });

    revalidatePath(SUPPORT_PATH);
    revalidatePath(ticketPath(ticketId));
    return { ok: true, message: "Ticket links updated." };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}

/* ---- triggerParseRetry ---- */

/**
 * Queue a parser retry for a ticket's linked product. The real scrape/parse
 * pipeline is not wired up in v1, so we record an honest queued JobRun + an
 * audit row and return a truthful "queued" message — we do NOT fabricate a parse
 * result.
 */
export async function triggerParseRetry(ticketId: string): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("support.write");
  if (!gate.ok || !("viewer" in gate)) return gate;
  if (!hasDatabase()) return { ok: false, reason: "no-db" };

  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, userId: true, productId: true },
    });
    if (!ticket) return { ok: false, reason: "not-found", message: "Ticket not found." };
    if (!ticket.productId) {
      return {
        ok: false,
        reason: "invalid",
        message: "Link a product to this ticket first.",
      };
    }

    await recordJobRun({
      jobType: "parser",
      status: "queued",
      createdBy: gate.viewer.id,
      metadata: { source: "support", ticketId: ticket.id, productId: ticket.productId },
    });

    await recordAdminAudit({
      actor: gate.viewer,
      action: "support.parse_retry",
      targetType: "support_ticket",
      targetId: ticket.id,
      targetUserId: ticket.userId,
      metadata: { productId: ticket.productId },
    });

    revalidatePath(ticketPath(ticketId));
    return { ok: true, message: "Reparse queued." };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}

/* ---- triggerNotificationResend ---- */

/**
 * Record a request to resend the customer's latest notification. Email is not
 * integrated in v1 — this writes an audit row + a queued notification JobRun and
 * returns an honest "queued" message. No real email is sent.
 */
export async function triggerNotificationResend(
  ticketId: string,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("support.write");
  if (!gate.ok || !("viewer" in gate)) return gate;
  if (!hasDatabase()) return { ok: false, reason: "no-db" };

  try {
    const ticket = await prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, userId: true },
    });
    if (!ticket) return { ok: false, reason: "not-found", message: "Ticket not found." };

    await recordJobRun({
      jobType: "notification",
      status: "queued",
      createdBy: gate.viewer.id,
      metadata: { source: "support", ticketId: ticket.id, userId: ticket.userId },
    });

    await recordAdminAudit({
      actor: gate.viewer,
      action: "support.notification_resend",
      targetType: "support_ticket",
      targetId: ticket.id,
      targetUserId: ticket.userId,
    });

    revalidatePath(ticketPath(ticketId));
    return { ok: true, message: "Resend queued." };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}

/* ---- queueAccountAction ---- */

/**
 * Queue a data export or account deletion on the linked user's behalf, on a
 * privacy request. Creates a DataRequest (the privacy pipeline picks it up) and
 * audits it. Privacy controls are never paywalled — this is always available to
 * support.
 */
export async function queueAccountAction(
  ticketId: string,
  userId: string,
  type: "export" | "delete",
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("support.write");
  if (!gate.ok || !("viewer" in gate)) return gate;
  if (!hasDatabase()) return { ok: false, reason: "no-db" };
  if (type !== "export" && type !== "delete") {
    return { ok: false, reason: "invalid", message: "Unknown request type." };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return { ok: false, reason: "invalid", message: "No user with that id." };
    }

    const request = await prisma.dataRequest.create({
      data: {
        userId: user.id,
        type,
        status: "pending",
        requestedById: gate.viewer.id,
        reason: "Queued from support ticket " + ticketId,
      },
      select: { id: true },
    });

    await recordAdminAudit({
      actor: gate.viewer,
      action: type === "export" ? "support.account_export" : "support.account_delete",
      targetType: "data_request",
      targetId: request.id,
      targetUserId: user.id,
      metadata: { ticketId, type },
    });

    revalidatePath(ticketPath(ticketId));
    return {
      ok: true,
      message:
        type === "export"
          ? "Data export queued."
          : "Account deletion queued for processing.",
    };
  } catch (e) {
    console.error(e);
    return { ok: false, reason: "error" };
  }
}
