/**
 * Turn a Better Auth error object (or anything thrown) into a calm, human
 * sentence for the auth UI. Client-safe — no server imports. Falls back to a
 * gentle generic line so we never surface a raw stack or status code.
 */
export function friendlyAuthError(
  error:
    | { code?: string; message?: string; status?: number; statusText?: string }
    | null
    | undefined,
  fallback = "Something went wrong. Please try again.",
): string {
  if (!error) return fallback;

  const code = ((error as { code?: string }).code ?? "").toUpperCase();
  const byCode: Record<string, string> = {
    INVALID_EMAIL_OR_PASSWORD: "That email or password doesn’t match. Try again.",
    INVALID_PASSWORD: "That password isn’t right. Try again.",
    USER_NOT_FOUND: "We couldn’t find an account with that email.",
    USER_ALREADY_EXISTS: "An account with that email already exists. Try signing in.",
    EMAIL_NOT_VERIFIED:
      "Please confirm your email first — we’ve sent you a fresh link.",
    PASSWORD_TOO_SHORT: "Use at least 8 characters for your password.",
    INVALID_TOKEN: "This link has expired or already been used. Request a new one.",
    CREDENTIAL_ACCOUNT_NOT_FOUND:
      "This account doesn’t use a password. Try a magic link or passkey.",
    SESSION_EXPIRED:
      "For your security, please sign in again to confirm this change.",
  };
  if (code && byCode[code]) return byCode[code];

  const msg = (error.message ?? "").trim();
  if (msg) return msg;
  return fallback;
}

/**
 * Billing-specific variant. Maps Stripe / Better-Auth subscription errors to
 * calm, on-brand copy and — crucially — never surfaces a raw Stripe string
 * (e.g. "Cannot update the subscription sub_… because there are no changes to
 * confirm"). The "already on Pro" cases all resolve to the same gentle line so
 * a stale upgrade click reads as reassurance, not an error.
 */
export function friendlyBillingError(
  error:
    | { code?: string; message?: string; status?: number; statusText?: string }
    | null
    | undefined,
  fallback = "Something went wrong starting your trial — please try again.",
): string {
  if (!error) return fallback;

  const alreadyPro =
    "You’re already on UniKart Coast — manage your plan below.";

  const code = ((error as { code?: string }).code ?? "").toUpperCase();
  const byCode: Record<string, string> = {
    ALREADY_SUBSCRIBED_PLAN: alreadyPro,
    SUBSCRIPTION_NOT_FOUND:
      "We couldn’t find that subscription. Please refresh and try again.",
    SESSION_EXPIRED:
      "For your security, please sign in again to manage your plan.",
  };
  if (code && byCode[code]) return byCode[code];

  // Some "already subscribed" states arrive as a raw Stripe message rather than
  // a typed code — most notably the "no changes to confirm" error you hit when
  // re-clicking upgrade with an active subscription. Catch these by shape and
  // map them to the same calm line instead of leaking Stripe's wording.
  const raw = (error.message ?? "").toLowerCase();
  if (
    raw.includes("no changes to confirm") ||
    raw.includes("already subscribed") ||
    raw.includes("already have")
  ) {
    return alreadyPro;
  }

  // Anything else: never echo a raw Stripe/Better-Auth string — fall back to a
  // gentle generic line.
  return fallback;
}
