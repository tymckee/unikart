// Server-only module: it imports next/headers and the Better Auth server
// instance. Never import this from a Client Component — use the client-safe
// helpers in ./utils (e.g. looksLikeEmail) instead.
import { headers } from "next/headers";
import { auth } from "./auth";
import { prisma } from "./db";
import type { BillingInfo, User } from "./types";

// Statuses Stripe reports that we treat as a live, Pro-granting subscription.
// Mirrors PRO_STATUSES in auth.ts (we keep Pro through the dunning grace window).
const ACTIVE_BILLING_STATUSES = new Set(["active", "trialing", "past_due"]);

/**
 * The authenticated user for the current request, or `null` when there's no
 * valid session. Backed by Better Auth (`auth.api.getSession`), reading the
 * incoming request headers (cookies). Server Components, the (app) layout, and
 * `getCurrentUserId` all funnel through here so there's one source of truth.
 *
 * The returned shape matches the app's `User` type. Better Auth's user carries
 * the extra `plan` column we declared on the model; we surface it (defaulting
 * to "free") and normalize the date fields to ISO strings.
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return null;
    const u = session.user as typeof session.user & { plan?: string | null };
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      image: u.image ?? null,
      plan: u.plan === "pro" ? "pro" : "free",
      createdAt: toIso(u.createdAt),
      updatedAt: toIso(u.updatedAt),
    };
  } catch (e) {
    console.error("[auth] getCurrentUser:", e);
    return null;
  }
}

/**
 * The authenticated user's id, or `null` when unauthenticated. Server actions
 * and read-side selectors use this to scope every query to the signed-in user:
 * actions return an auth error and selectors return empty when it's null.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.id ?? null;
}

/**
 * Server-side billing state for the given user, read straight from the
 * Subscription row in Neon — the source of truth. The client session does not
 * reliably carry the custom `plan` field, so the Plan & billing card resolves
 * its state from this instead (no more "already subscribed" re-clicks).
 *
 * We pick the most relevant subscription: an active/trialing/past_due one if
 * present, otherwise the most recently created row. Returns a calm default
 * (`active: false`, `status: "none"`) when there's no subscription or no DB.
 */
export async function getBillingInfo(userId: string): Promise<BillingInfo> {
  const empty: BillingInfo = {
    active: false,
    status: "none",
    billingInterval: null,
    periodEnd: null,
    trialEnd: null,
    cancelAtPeriodEnd: false,
  };

  try {
    const subscriptions = await prisma.subscription.findMany({
      where: { referenceId: userId },
      orderBy: { periodEnd: "desc" },
    });
    if (subscriptions.length === 0) return empty;

    // Prefer a live (Pro-granting) subscription; otherwise the latest row so we
    // can still surface a "canceled" state accurately.
    const sub =
      subscriptions.find((s) => ACTIVE_BILLING_STATUSES.has(s.status)) ??
      subscriptions[0];

    const active = ACTIVE_BILLING_STATUSES.has(sub.status);
    const status = normalizeBillingStatus(sub.status);
    const billingInterval =
      sub.billingInterval === "year"
        ? "year"
        : sub.billingInterval === "month"
          ? "month"
          : null;

    return {
      active,
      status,
      billingInterval,
      periodEnd: sub.periodEnd ? sub.periodEnd.toISOString() : null,
      trialEnd: sub.trialEnd ? sub.trialEnd.toISOString() : null,
      cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
    };
  } catch (e) {
    console.error("[auth] getBillingInfo:", e);
    return empty;
  }
}

function normalizeBillingStatus(value: string): BillingInfo["status"] {
  switch (value) {
    case "active":
    case "trialing":
    case "past_due":
    case "canceled":
    case "incomplete":
      return value;
    default:
      return "none";
  }
}

/**
 * Pro-gate guard. Resolves to the signed-in Pro user's id, or returns a typed
 * error result (never throws) so server actions can `if (!("id" in gate))`
 * short-circuit cleanly. Mirrors Stripe via the User.plan column (see auth.ts).
 *
 *   const gate = await requirePro();
 *   if ("reason" in gate) return gate; // { ok:false, reason, message }
 *   // ...gate.id is a Pro user
 */
export async function requirePro(): Promise<
  | { id: string }
  | { ok: false; reason: "unauthorized" | "upgrade-required"; message?: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, reason: "unauthorized" };
  if (user.plan !== "pro") {
    return {
      ok: false,
      reason: "upgrade-required",
      message: "This feature is part of UniKart Coast.",
    };
  }
  return { id: user.id };
}

function toIso(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
