import { prisma } from "../db";
import { sendDigestEmail, type DigestItem } from "../email";
import { clampInt, DEFAULT_NOTIFICATION_PREFERENCES } from "../notifications";
import type { NotificationPreferences } from "../types";

/**
 * Email-digest job (Phase 0 notifications).
 *
 * The price/stock check already writes change-based Notification rows; this job
 * is what actually reaches out. Every hour the scheduled function calls the
 * CRON-gated route, which calls `sendDueDigests`.
 *
 * Delivery is once-per-local-period and idempotent. A user is "due" when, in
 * THEIR timezone, the local time is at or after their chosen send hour (and, for
 * weekly, it's their weekday) AND no digest has gone out yet this local day. We
 * gather their pending (un-emailed) notifications into one calm email, send it,
 * stamp those rows `emailedAt`, and record `lastDigestAt` on their preferences.
 *
 * Why "at or after" + a per-period marker rather than exact-hour equality:
 *  - DST-safe: a spring-forward day removes an hour from the local clock, so an
 *    exact match could skip a send entirely. "At or after" still fires the next
 *    hour, and the per-day marker stops it from sending twice.
 *  - No double sends across the hourly drain loop, and no head-of-line blocking:
 *    a user who succeeds is marked and drops out; one who fails simply isn't
 *    marked and is retried on a later hourly tick the same day, so a failing
 *    cohort can't permanently starve everyone behind them.
 *
 * `read` (the in-app bell) is deliberately left untouched — emailing isn't
 * reading. Prisma lives here (this runs inside a Next route), not in the Netlify
 * function, which stays Prisma-free and only triggers the route on a cron.
 */

/** How many items to actually list in the email; the rest become "and N more". */
const MAX_ITEMS_IN_EMAIL = 12;
/** Cap candidate users scanned per call, so one run can't sprawl. At Phase 0
 *  scale this is a generous ceiling; revisit with cursor pagination if the
 *  pending-notification population ever approaches it. */
const MAX_CANDIDATES = 1000;

export interface DigestRunResult {
  candidates: number; // users with pending notifications considered
  due: number; // users due this run (before the batch cap)
  processed: number; // users we attempted this call (≤ batch)
  sent: number; // digests actually sent (or would-send, in dryRun)
  dryRun: boolean;
}

/** Job-side preferences, including the delivery marker not exposed to clients. */
type JobPrefs = NotificationPreferences & { lastDigestAt: Date | null };

/** The current hour (0–23) and weekday (0=Sun … 6=Sat) in a given IANA tz. */
function localHourWeekday(
  date: Date,
  tz: string,
): { hour: number; weekday: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "2-digit",
      hour12: false,
      weekday: "short",
    }).formatToParts(date);
    const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
    const hour = parseInt(hourStr, 10) % 24; // "24" (midnight) → 0
    const wd = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
    if (!Number.isFinite(hour) || weekday < 0) return null;
    return { hour, weekday };
  } catch {
    return null;
  }
}

/** The local calendar date ("YYYY-MM-DD") in a given tz, for once-per-day dedup. */
function localDateString(date: Date, tz: string): string | null {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return null;
  }
}

/** Whether a user is due a digest at this moment, per their prefs (see header). */
function isDueNow(prefs: JobPrefs, now: Date): boolean {
  if (!prefs.emailEnabled) return false;
  const local = localHourWeekday(now, prefs.timezone);
  if (!local) return false;
  // The send hour must have arrived (at-or-after, so DST can't skip it).
  if (local.hour < prefs.digestSendHour) return false;
  // Weekly digests only fire on the chosen weekday.
  if (prefs.digestFrequency === "weekly" && local.weekday !== prefs.digestWeekday) {
    return false;
  }
  // Once per local day: skip if a digest already went out today (their time).
  const today = localDateString(now, prefs.timezone);
  const last = prefs.lastDigestAt
    ? localDateString(prefs.lastDigestAt, prefs.timezone)
    : null;
  if (today && last && today === last) return false;
  return true;
}

type PrefsRow = {
  emailEnabled: boolean;
  digestFrequency: string;
  digestSendHour: number;
  digestWeekday: number;
  timezone: string;
  lastDigestAt: Date | null;
} | null;

/** Resolve a (possibly absent) prefs row into bounded job prefs. Values are
 *  clamped on read too, so a bad stored value degrades to a safe default rather
 *  than silently disabling delivery. */
function resolvePrefs(row: PrefsRow): JobPrefs {
  const d = DEFAULT_NOTIFICATION_PREFERENCES;
  if (!row) return { ...d, lastDigestAt: null };
  return {
    emailEnabled: row.emailEnabled,
    digestFrequency: row.digestFrequency === "weekly" ? "weekly" : "daily",
    digestSendHour: clampInt(row.digestSendHour, 0, 23, d.digestSendHour),
    digestWeekday: clampInt(row.digestWeekday, 0, 6, d.digestWeekday),
    timezone: row.timezone || d.timezone,
    lastDigestAt: row.lastDigestAt,
  };
}

/**
 * Build one user's digest from their pending notifications, send it, and claim
 * those rows. All three reads/writes are bounded by the same `now`, so the
 * count, the rendered items, and the claim describe exactly the same set even
 * if new notifications arrive mid-run. Returns true if a digest was sent (or
 * would be, in dryRun).
 */
async function deliverDigest(
  user: { id: string; email: string },
  appUrl: string,
  now: Date,
  dryRun: boolean,
): Promise<boolean> {
  const where = { userId: user.id, emailedAt: null, createdAt: { lte: now } };

  const total = await prisma.notification.count({ where });
  if (total === 0) return false;

  const recent = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: MAX_ITEMS_IN_EMAIL,
    select: { title: true, body: true, productId: true },
  });

  // Resolve thumbnails + deep links for the rendered items (cutout preferred).
  const productIds = recent
    .map((n) => n.productId)
    .filter((id): id is string => Boolean(id));
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, imageUrl: true, cutoutUrl: true },
      })
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const baseUrl = appUrl.replace(/\/+$/, "");

  const items: DigestItem[] = recent.map((n) => {
    const p = n.productId ? byId.get(n.productId) : undefined;
    return {
      title: n.title,
      body: n.body,
      imageUrl: p?.cutoutUrl ?? p?.imageUrl ?? null,
      // Only deep-link when the product still exists; otherwise the Hub.
      url: p ? `${baseUrl}/products/${p.id}` : `${baseUrl}/dashboard`,
    };
  });

  if (dryRun) return true;

  // Send first; only claim the rows + mark the period once the send succeeds,
  // so a transient failure leaves the user due for a later tick rather than
  // silently dropping their changes.
  await sendDigestEmail({ to: user.email, items, total, appUrl });
  await prisma.notification.updateMany({ where, data: { emailedAt: now } });
  await prisma.notificationPreferences.upsert({
    where: { userId: user.id },
    create: { userId: user.id, lastDigestAt: now },
    update: { lastDigestAt: now },
  });
  return true;
}

/**
 * Find users due for a digest right now and send them. Processes at most
 * `batch` due users per call; the scheduled function loops until a call makes no
 * forward progress (`sent === 0`), so each invocation stays well under the
 * function time limit while the hour's backlog still drains.
 */
export async function sendDueDigests(opts?: {
  now?: Date;
  batch?: number;
  appUrl?: string;
  dryRun?: boolean;
}): Promise<DigestRunResult> {
  const now = opts?.now ?? new Date();
  const batch = Math.max(1, opts?.batch ?? 10);
  const dryRun = Boolean(opts?.dryRun);
  const appUrl =
    opts?.appUrl?.trim() ||
    process.env.BETTER_AUTH_URL ||
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    "https://uni-kart.com";

  // Candidate users: anyone with at least one pending notification. Ordered so
  // selection is deterministic rather than relying on implicit DB order.
  const pending = await prisma.notification.findMany({
    where: { emailedAt: null },
    select: { userId: true },
    distinct: ["userId"],
    orderBy: { userId: "asc" },
    take: MAX_CANDIDATES,
  });
  const candidateIds = pending.map((p) => p.userId);
  if (candidateIds.length === 0) {
    return { candidates: 0, due: 0, processed: 0, sent: 0, dryRun };
  }

  const users = await prisma.user.findMany({
    where: { id: { in: candidateIds }, status: "active" },
    orderBy: { id: "asc" },
    select: {
      id: true,
      email: true,
      notificationPreferences: {
        select: {
          emailEnabled: true,
          digestFrequency: true,
          digestSendHour: true,
          digestWeekday: true,
          timezone: true,
          lastDigestAt: true,
        },
      },
    },
  });

  const due = users.filter((u) =>
    isDueNow(resolvePrefs(u.notificationPreferences), now),
  );
  const slice = due.slice(0, batch);

  let sent = 0;
  const results = await Promise.allSettled(
    slice.map((u) => deliverDigest({ id: u.id, email: u.email }, appUrl, now, dryRun)),
  );
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) sent++;
    else if (r.status === "rejected") {
      console.error("[digest] deliver failed:", r.reason);
    }
  }

  return {
    candidates: candidateIds.length,
    due: due.length,
    processed: slice.length,
    sent,
    dryRun,
  };
}
