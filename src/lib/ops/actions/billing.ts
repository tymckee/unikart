"use server";

/**
 * UniKart Ops — Billing server actions.
 *
 * Stripe runs in TEST mode here, so none of the money-moving capabilities are
 * live in v1. Refunds, credits, and operator-initiated cancellations are NOT
 * enabled: each action below is a guarded stub that returns ok:false with an
 * honest message. The UI keeps the corresponding buttons disabled and labelled
 * "Not live (test mode)".
 *
 * The stubs still show the intended shape for a future v2: they gate on
 * billing.refund and would write an audit row before doing anything. We do NOT
 * fabricate a result, call Stripe, or move money. We never read or render card
 * data (there is none in this schema).
 */
import { requireOpsPermission } from "@/lib/ops/guard";
import type { OpsActionResult } from "@/lib/ops/types";

/** Shared "not enabled in v1" response (test mode). */
const NOT_LIVE: OpsActionResult = {
  ok: false,
  reason: "invalid",
  message: "Refunds are not enabled in v1.",
};

/**
 * Issue a refund for a subscription charge. NOT live in v1 — Stripe is in test
 * mode and UniKart never moves money from Ops yet. Gated on billing.refund so an
 * unauthorized caller is still rejected first; an authorized caller gets the
 * honest "not enabled" result rather than a fabricated success.
 *
 * v2 shape (not implemented): on success this would call Stripe, then write an
 * audit row via recordAdminAudit({ action: "billing.refund", ... }) with the
 * actor, target subscription, amount, and reason.
 */
export async function refundCharge(
  subscriptionId: string,
  reason: string,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("billing.refund");
  if (!gate.ok) return gate;
  void subscriptionId;
  void reason;
  // Intentionally a no-op in v1: no Stripe call, no audit row for a non-event.
  return NOT_LIVE;
}

/**
 * Apply an account credit. NOT live in v1 (test mode). Same contract as
 * refundCharge: gate first, then return the honest "not enabled" result.
 */
export async function applyCredit(
  subscriptionId: string,
  reason: string,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("billing.refund");
  if (!gate.ok) return gate;
  void subscriptionId;
  void reason;
  return NOT_LIVE;
}

/**
 * Cancel a subscription from Ops. NOT live in v1 (test mode). Users manage their
 * own UniKart Coast subscription via the customer billing portal; operator-side
 * cancellation is deferred. Gate first, then return the honest result.
 */
export async function cancelSubscription(
  subscriptionId: string,
  reason: string,
): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("billing.refund");
  if (!gate.ok) return gate;
  void subscriptionId;
  void reason;
  return NOT_LIVE;
}
