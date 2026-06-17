"use server";

/**
 * UniKart Ops — Products server actions.
 *
 * Every mutation: (1) gates via requireOpsPermission, (2) writes an audit row
 * with the actor, (3) revalidates the affected paths, (4) returns an
 * OpsActionResult.
 *
 * Several capabilities here (reparse, price/stock check, needs-review,
 * disable-tracking) are *operator intents* in v1 — the real background
 * scraping/checking pipeline records the request as a queued JobRun and an
 * audit entry, then returns an honest message. We never fabricate a scrape
 * result. Limitations are noted on each action.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireOpsPermission } from "@/lib/ops/guard";
import { recordAdminAudit } from "@/lib/ops/audit";
import { recordJobRun } from "@/lib/ops/jobs";
import type { OpsActionResult } from "@/lib/ops/types";

function revalidateProduct(productId: string) {
  revalidatePath("/ops/products");
  revalidatePath("/ops/products/" + productId);
}

/**
 * Queue a reparse of the product's source page. v1: records the intent as a
 * queued parser JobRun + audit; the parser pipeline picks it up. We do not run
 * the scrape inline or fake a parsed result.
 */
export async function reparseProduct(productId: string): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("products.reparse");
  if (!gate.ok || !("viewer" in gate)) return gate;
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, userId: true, originalUrl: true, storeDomain: true },
    });
    if (!product) return { ok: false, reason: "not-found", message: "Product not found." };

    const jobId = await recordJobRun({
      jobType: "parser",
      status: "queued",
      createdBy: gate.viewer.id,
      metadata: { productId, domain: product.storeDomain, trigger: "ops.reparse" },
    });
    await recordAdminAudit({
      actor: gate.viewer,
      action: "product.reparse",
      targetType: "product",
      targetId: productId,
      targetUserId: product.userId,
      metadata: { jobId, domain: product.storeDomain },
    });
    revalidateProduct(productId);
    return { ok: true, message: "Reparse queued." };
  } catch (e) {
    console.error("[ops] reparseProduct:", e);
    return { ok: false, reason: "error" };
  }
}

/**
 * Queue an immediate price/stock check. v1: records a queued price_check JobRun
 * + audit; the scheduled checker runs it. No inline check, no fabricated price.
 */
export async function runCheckNow(productId: string): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("products.mutate");
  if (!gate.ok || !("viewer" in gate)) return gate;
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, userId: true, storeDomain: true },
    });
    if (!product) return { ok: false, reason: "not-found", message: "Product not found." };

    const jobId = await recordJobRun({
      jobType: "price_check",
      status: "queued",
      createdBy: gate.viewer.id,
      metadata: { productId, domain: product.storeDomain, trigger: "ops.check_now" },
    });
    await recordAdminAudit({
      actor: gate.viewer,
      action: "product.check_now",
      targetType: "product",
      targetId: productId,
      targetUserId: product.userId,
      metadata: { jobId },
    });
    revalidateProduct(productId);
    return { ok: true, message: "Check queued." };
  } catch (e) {
    console.error("[ops] runCheckNow:", e);
    return { ok: false, reason: "error" };
  }
}

/**
 * Flag the product for parser review. v1: recorded in the audit log only (no
 * dedicated review-queue column yet) — the reason is preserved on the audit
 * entry. Limitation noted in the section summary.
 */
export async function markNeedsReview(
  productId: string,
  reason: string,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("products.mutate");
  if (!gate.ok || !("viewer" in gate)) return gate;
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, userId: true, metadataConfidence: true },
    });
    if (!product) return { ok: false, reason: "not-found", message: "Product not found." };

    await recordAdminAudit({
      actor: gate.viewer,
      action: "product.needs_review",
      targetType: "product",
      targetId: productId,
      targetUserId: product.userId,
      reason,
      before: { metadataConfidence: product.metadataConfidence },
    });
    revalidateProduct(productId);
    return { ok: true, message: "Flagged for review." };
  } catch (e) {
    console.error("[ops] markNeedsReview:", e);
    return { ok: false, reason: "error" };
  }
}

/**
 * Normalize the store name/domain (e.g. fix a mis-parsed merchant). Updates the
 * record and records before/after on the audit log.
 */
export async function updateStoreNormalization(
  productId: string,
  storeName: string,
  storeDomain: string,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("products.mutate");
  if (!gate.ok || !("viewer" in gate)) return gate;

  const name = storeName.trim();
  const domain = storeDomain.trim().toLowerCase();
  if (!name || !domain) {
    return { ok: false, reason: "invalid", message: "Store name and domain are required." };
  }

  try {
    const before = await prisma.product.findUnique({
      where: { id: productId },
      select: { storeName: true, storeDomain: true, userId: true },
    });
    if (!before) return { ok: false, reason: "not-found", message: "Product not found." };

    await prisma.product.update({
      where: { id: productId },
      data: { storeName: name, storeDomain: domain },
    });
    await recordAdminAudit({
      actor: gate.viewer,
      action: "product.store.normalize",
      targetType: "product",
      targetId: productId,
      targetUserId: before.userId,
      before: { storeName: before.storeName, storeDomain: before.storeDomain },
      after: { storeName: name, storeDomain: domain },
    });
    revalidateProduct(productId);
    return { ok: true, message: "Store updated." };
  } catch (e) {
    console.error("[ops] updateStoreNormalization:", e);
    return { ok: false, reason: "error" };
  }
}

/**
 * Disable price/stock tracking for the product. v1: recorded as operator intent
 * on the audit log only — there is no dedicated "tracking enabled" column yet,
 * so this does not currently stop the scheduler. Limitation noted in the
 * section summary.
 */
export async function disableTracking(
  productId: string,
  reason: string,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("products.mutate");
  if (!gate.ok || !("viewer" in gate)) return gate;
  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, userId: true },
    });
    if (!product) return { ok: false, reason: "not-found", message: "Product not found." };

    await recordAdminAudit({
      actor: gate.viewer,
      action: "product.tracking.disable",
      targetType: "product",
      targetId: productId,
      targetUserId: product.userId,
      reason,
      metadata: { note: "recorded as intent; no tracking column in v1" },
    });
    revalidateProduct(productId);
    return { ok: true, message: "Tracking disable recorded." };
  } catch (e) {
    console.error("[ops] disableTracking:", e);
    return { ok: false, reason: "error" };
  }
}

/**
 * Archive the product on the customer's behalf (e.g. broken / removed listing).
 * Sets isArchived and records before/after + reason.
 */
export async function archiveForUser(
  productId: string,
  reason: string,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("products.mutate");
  if (!gate.ok || !("viewer" in gate)) return gate;
  try {
    const before = await prisma.product.findUnique({
      where: { id: productId },
      select: { isArchived: true, userId: true },
    });
    if (!before) return { ok: false, reason: "not-found", message: "Product not found." };
    if (before.isArchived) {
      return { ok: true, message: "Already archived." };
    }

    await prisma.product.update({
      where: { id: productId },
      data: { isArchived: true },
    });
    await recordAdminAudit({
      actor: gate.viewer,
      action: "product.archive",
      targetType: "product",
      targetId: productId,
      targetUserId: before.userId,
      reason,
      before: { isArchived: before.isArchived },
      after: { isArchived: true },
    });
    revalidateProduct(productId);
    return { ok: true, message: "Product archived." };
  } catch (e) {
    console.error("[ops] archiveForUser:", e);
    return { ok: false, reason: "error" };
  }
}

/**
 * Add an internal note about the product. Stored as a SupportNote
 * (visibility "internal") tied to the product's owner, with the product id in
 * metadata so it can be traced back. Never customer-visible.
 */
export async function addProductNote(
  productId: string,
  body: string,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("products.mutate");
  if (!gate.ok || !("viewer" in gate)) return gate;

  const text = body.trim();
  if (text.length < 2) {
    return { ok: false, reason: "invalid", message: "Note is too short." };
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, userId: true, title: true },
    });
    if (!product) return { ok: false, reason: "not-found", message: "Product not found." };

    const note = await prisma.supportNote.create({
      data: {
        userId: product.userId,
        adminUserId: gate.viewer.id,
        body: text,
        visibility: "internal",
      },
      select: { id: true },
    });
    await recordAdminAudit({
      actor: gate.viewer,
      action: "product.note.add",
      targetType: "product",
      targetId: productId,
      targetUserId: product.userId,
      metadata: { noteId: note.id, productTitle: product.title },
    });
    revalidateProduct(productId);
    return { ok: true, message: "Note added." };
  } catch (e) {
    console.error("[ops] addProductNote:", e);
    return { ok: false, reason: "error" };
  }
}
