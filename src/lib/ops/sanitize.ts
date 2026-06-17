/**
 * UniKart Ops — metadata sanitizer.
 *
 * Everything written to AdminAuditLog / AnalyticsEvent / APIUsageEvent metadata
 * runs through here first. We:
 *   - drop keys that look like secrets or sensitive credentials,
 *   - drop keys that look like raw payment-card data,
 *   - truncate long strings and cap overall size,
 * so we never log secrets or PII bodies (a hard requirement — see
 * docs/OPS_SECURITY.md / docs/OPS_PRIVACY.md).
 */

/** Keys whose values are secrets / credentials and must never be stored. */
const SECRET_KEY_RE =
  /(pass(word)?|secret|token|api[-_]?key|authorization|auth|cookie|session|bearer|private[-_]?key|client[-_]?secret|webhook[-_]?secret|otp|mfa|cvv|cvc|card[-_]?number|pan|iban|routing|account[-_]?number)/i;

/** Keys we treat as raw payment data — never stored, even partially. */
const CARD_KEY_RE = /(card|cc[-_]?num|credit)/i;

const MAX_STRING = 500;
const MAX_DEPTH = 4;
const MAX_KEYS = 60;
const MAX_JSON = 8000;

const REDACTED = "[redacted]";

function sanitizeValue(value: unknown, depth: number): unknown {
  if (value == null) return value;
  if (typeof value === "string") {
    return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (depth >= MAX_DEPTH) return "[…]";
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => sanitizeValue(v, depth + 1));
  }
  if (typeof value === "object") {
    return sanitizeObject(value as Record<string, unknown>, depth + 1);
  }
  // functions, symbols, bigint, etc.
  return undefined;
}

function sanitizeObject(
  obj: Record<string, unknown>,
  depth: number,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [key, val] of Object.entries(obj)) {
    if (count >= MAX_KEYS) break;
    count++;
    if (SECRET_KEY_RE.test(key) || CARD_KEY_RE.test(key)) {
      out[key] = REDACTED;
      continue;
    }
    const clean = sanitizeValue(val, depth);
    if (clean !== undefined) out[key] = clean;
  }
  return out;
}

/** Deep-sanitize an arbitrary metadata object. */
export function sanitizeMetadata(
  input: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!input || typeof input !== "object") return null;
  try {
    return sanitizeObject(input, 0);
  } catch {
    return null;
  }
}

/**
 * Sanitize and JSON-stringify a metadata object for a `*Json` column. Returns
 * null when there's nothing to store. Caps total length so a single row can't
 * blow up.
 */
export function safeJson(
  input: Record<string, unknown> | null | undefined,
): string | null {
  const clean = sanitizeMetadata(input);
  if (!clean || Object.keys(clean).length === 0) return null;
  try {
    const json = JSON.stringify(clean);
    return json.length > MAX_JSON ? `${json.slice(0, MAX_JSON)}…"}` : json;
  } catch {
    return null;
  }
}

/**
 * Snapshot only an allow-listed set of fields from a record (for audit
 * before/after diffs), then sanitize. Prevents accidentally snapshotting an
 * entire row that may contain sensitive columns.
 */
export function snapshot<T extends Record<string, unknown>>(
  obj: T | null | undefined,
  fields: (keyof T)[],
): string | null {
  if (!obj) return null;
  const picked: Record<string, unknown> = {};
  for (const f of fields) picked[String(f)] = obj[f];
  return safeJson(picked);
}
