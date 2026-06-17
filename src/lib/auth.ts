import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";
import {
  sendMagicLinkEmail,
  sendResetPasswordEmail,
  sendVerificationEmail,
} from "@/lib/email";

/**
 * Server-side Better Auth instance — the source of truth for authentication.
 *
 * Stage: auth core only. The route handler at /api/auth/[...all] mounts this;
 * the existing getCurrentUser / mock user are intentionally left untouched and
 * get rewired in the next stage.
 */

// Resolve the canonical site origin. BETTER_AUTH_URL wins; otherwise fall back
// to Netlify's deploy URL (set at runtime) and finally the production domain.
const SITE_URL =
  process.env.BETTER_AUTH_URL ??
  process.env.URL ??
  "https://uni-kart.com";

// Derive the WebAuthn relying-party id (the registrable domain, no scheme/port)
// and the origin from the resolved site URL. On localhost the rpID must be the
// bare hostname ("localhost").
function rpIdFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "uni-kart.com";
  }
}

const rpID = rpIdFromUrl(SITE_URL);
// Origin must not carry a trailing slash. Always trust the production origins
// for passkey ceremonies too, so a custom-domain request still verifies.
const passkeyOrigins = Array.from(
  new Set([
    SITE_URL.replace(/\/$/, ""),
    "https://uni-kart.com",
    "http://localhost:3000",
  ]),
);

export const auth = betterAuth({
  baseURL: SITE_URL,
  secret: process.env.BETTER_AUTH_SECRET,

  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    // "Forgot password" — sent to a signed-out user. The reset link lands on
    // /reset-password (carrying ?token=…), which calls authClient.resetPassword.
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail(user.email, url);
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    // After confirming, send the user straight into the app.
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url);
    },
  },

  // Account deletion (Danger zone). With a password account, the client passes
  // the current password and Better Auth verifies + deletes immediately
  // (cascading to the user's products, collections, sessions, passkeys, …).
  user: {
    deleteUser: {
      enabled: true,
    },
  },

  session: {
    // 7-day sessions, refreshed at most once a day; a short cookie cache keeps
    // getSession cheap between refreshes.
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  // The production domain plus local dev. Add deploy/custom origins as needed.
  trustedOrigins: [
    "https://uni-kart.com",
    "https://www.uni-kart.com",
    "http://localhost:3000",
  ],

  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url);
      },
    }),
    passkey({
      rpID,
      rpName: "UniKart",
      origin: passkeyOrigins,
    }),
    // Keep last: lets Better Auth set cookies from Server Actions / RSC.
    nextCookies(),
  ],
});
