import type { DigestFrequency, NotificationPreferences } from "./types";

/**
 * Shared, Prisma-free helpers for notification preferences: the calm defaults
 * applied when a user has no preferences row yet, and a sanitizer that coerces
 * untrusted input (from the settings form) into a valid, bounded shape. Kept
 * dependency-light so the read layer, the server action, and the digest job can
 * all import it without pulling in Prisma or server-only modules.
 */

/** Calm defaults: email on, a single daily digest at 08:00 local. */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailEnabled: true,
  digestFrequency: "daily",
  digestSendHour: 8,
  digestWeekday: 1, // Monday
  timezone: "America/New_York",
};

function isDigestFrequency(v: unknown): v is DigestFrequency {
  return v === "daily" || v === "weekly";
}

/** Clamp an integer into [min, max], falling back to `fallback` if not finite. */
export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? Math.round(v) : Number.NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * A conservative IANA-timezone check. We don't ship a full tz database here;
 * we just confirm the runtime can resolve the name (so the digest job can rely
 * on it) and reject anything malformed. Falls back to the default on failure.
 */
function safeTimezone(v: unknown): string {
  if (typeof v !== "string" || v.length === 0 || v.length > 64) {
    return DEFAULT_NOTIFICATION_PREFERENCES.timezone;
  }
  try {
    // Throws RangeError for an unknown/invalid time zone.
    new Intl.DateTimeFormat("en-US", { timeZone: v });
    return v;
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES.timezone;
  }
}

/**
 * Coerce arbitrary input into a valid NotificationPreferences. Every field is
 * validated/bounded so a malformed or hostile payload can never persist an
 * out-of-range value (e.g. a send hour of 99 that would silently never fire).
 */
export function sanitizeNotificationPreferences(
  input: Partial<Record<keyof NotificationPreferences, unknown>>,
): NotificationPreferences {
  const d = DEFAULT_NOTIFICATION_PREFERENCES;
  return {
    emailEnabled:
      typeof input.emailEnabled === "boolean" ? input.emailEnabled : d.emailEnabled,
    digestFrequency: isDigestFrequency(input.digestFrequency)
      ? input.digestFrequency
      : d.digestFrequency,
    digestSendHour: clampInt(input.digestSendHour, 0, 23, d.digestSendHour),
    digestWeekday: clampInt(input.digestWeekday, 0, 6, d.digestWeekday),
    timezone: safeTimezone(input.timezone),
  };
}
