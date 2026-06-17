/**
 * UniKart Ops — first-party analytics.
 *
 * `trackEvent()` records a single, privacy-conscious AnalyticsEvent. This is the
 * deliberate alternative to invasive third-party tracking: minimal metadata,
 * hashed IP only when asked, and never any payment or sensitive request data.
 *
 * Best-effort and fire-and-forget safe — never throws into the caller.
 */
import { hasDatabase, prisma } from "../db";
import { hashIp } from "./request-context";
import { safeJson } from "./sanitize";

/** The canonical product event names (keep stable — dashboards group on these). */
export type AnalyticsEventName =
  | "user_signed_up"
  | "user_logged_in"
  | "onboarding_started"
  | "onboarding_completed"
  | "paste_url_submitted"
  | "product_parse_started"
  | "product_parse_succeeded"
  | "product_parse_failed"
  | "product_saved"
  | "product_edited"
  | "product_released"
  | "product_archived"
  | "product_marked_purchased"
  | "collection_created"
  | "target_price_set"
  | "alert_rule_created"
  | "notification_generated"
  | "notification_opened"
  | "item_added_to_cart"
  | "item_removed_from_cart"
  | "checkout_assistant_started"
  | "checkout_step_opened"
  | "checkout_assistant_completed"
  | "signal_viewed"
  | "extension_save_started"
  | "extension_save_completed";

export interface TrackOptions {
  userId?: string | null;
  sessionId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  source?: "web" | "extension" | "system" | "api";
  /** Provide a raw IP to store its hash (never the raw value). */
  ip?: string | null;
  /** Also bump User.lastActiveAt for this user (default true when userId set). */
  touchLastActive?: boolean;
}

/**
 * Record a product analytics event. Accepts a known event name or any string
 * (so new events don't require a code change), but prefer the union.
 */
export async function trackEvent(
  eventName: AnalyticsEventName | (string & {}),
  options: TrackOptions = {},
): Promise<void> {
  if (!hasDatabase()) return;
  try {
    await prisma.analyticsEvent.create({
      data: {
        eventName,
        userId: options.userId ?? null,
        sessionId: options.sessionId ?? null,
        entityType: options.entityType ?? null,
        entityId: options.entityId ?? null,
        metadataJson: safeJson(options.metadata),
        source: options.source ?? "web",
        ipHash: hashIp(options.ip),
      },
    });

    const touch = options.touchLastActive ?? Boolean(options.userId);
    if (touch && options.userId) {
      await prisma.user
        .update({
          where: { id: options.userId },
          data: { lastActiveAt: new Date() },
        })
        .catch(() => {});
    }
  } catch (e) {
    console.error("[ops] trackEvent failed:", e);
  }
}
