import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { magicLink } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { stripe } from "@better-auth/stripe";
import { nextCookies } from "better-auth/next-js";
import Stripe from "stripe";
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

// Stripe client — the single Stripe SDK instance the Better Auth Stripe plugin
// drives (checkout sessions, billing portal, webhook verification). The plugin
// auto-mounts its webhook at /api/auth/stripe/webhook (already registered in
// the Stripe dashboard).
const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Mirror a Stripe subscription's lifecycle onto the existing User.plan column,
// which is the app's gating source of truth (getCurrentUser reads it). The plan
// flips to "pro" while the subscription is active/trialing/past_due (we keep Pro
// during the dunning grace window) and back to "free" otherwise.
async function setUserPlan(referenceId: string, plan: "free" | "pro") {
  try {
    await prisma.user.update({
      where: { id: referenceId },
      data: { plan },
    });
  } catch (e) {
    console.error(`[stripe] setUserPlan(${referenceId}, ${plan}):`, e);
  }
}

const PRO_STATUSES = new Set(["active", "trialing", "past_due"]);

// The internal Ops Console runs on its own subdomain (ops.uni-kart.com). Sign-in
// happens on that origin, so it must be a trusted origin too — otherwise Better
// Auth rejects the request with "Invalid origin". Derived from OPS_HOST so it
// tracks the deployment config.
const OPS_ORIGIN = `https://${(process.env.OPS_HOST || "ops.uni-kart.com")
  .trim()
  .toLowerCase()}`;

// Origin must not carry a trailing slash. Always trust the production origins
// for passkey ceremonies too, so a custom-domain request still verifies.
const passkeyOrigins = Array.from(
  new Set([
    SITE_URL.replace(/\/$/, ""),
    "https://uni-kart.com",
    OPS_ORIGIN,
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
    OPS_ORIGIN, // ops.uni-kart.com — the Ops Console signs in on its own subdomain
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
    stripe({
      stripeClient,
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      // Create a Stripe customer the moment someone signs up, so upgrading later
      // is a single click (no customer-creation round-trip at checkout time).
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: [
          {
            name: "pro",
            priceId: process.env.STRIPE_PRO_PRICE_ID!,
            annualDiscountPriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID,
            freeTrial: { days: 7 },
          },
        ],
        // Checkout completed → grant Pro. referenceId is the owning User.id.
        onSubscriptionComplete: async ({ subscription }) => {
          await setUserPlan(subscription.referenceId, "pro");
        },
        // Any subscription change → reconcile the plan from Stripe's status.
        // Keep Pro through active/trialing/past_due (grace); drop to free otherwise.
        onSubscriptionUpdate: async ({ stripeSubscription, subscription }) => {
          await setUserPlan(
            subscription.referenceId,
            PRO_STATUSES.has(stripeSubscription.status) ? "pro" : "free",
          );
        },
        // Subscription fully deleted → back to free.
        onSubscriptionDeleted: async ({ subscription }) => {
          await setUserPlan(subscription.referenceId, "free");
        },
      },
      // Catch-all for raw Stripe events the lifecycle callbacks don't cover.
      onEvent: async (event) => {
        switch (event.type) {
          case "invoice.paid": {
            // Re-affirm Pro on a successful renewal/payment. Look up the local
            // subscription by Stripe customer id and bump the owning user.
            const invoice = event.data.object as { customer?: string | null };
            const customerId = invoice.customer ?? null;
            if (!customerId) break;
            try {
              const sub = await prisma.subscription.findFirst({
                where: { stripeCustomerId: customerId },
                select: { referenceId: true },
              });
              if (sub?.referenceId) await setUserPlan(sub.referenceId, "pro");
            } catch (e) {
              console.error("[stripe] invoice.paid reconcile:", e);
            }
            break;
          }
          case "invoice.payment_failed": {
            // A failed charge starts Stripe's dunning window. We deliberately
            // keep the user on Pro during the grace period (the subscription
            // moves to past_due, which PRO_STATUSES still treats as Pro) and
            // only log here. onSubscriptionDeleted handles the eventual drop.
            const invoice = event.data.object as { customer?: string | null };
            console.warn(
              `[stripe] invoice.payment_failed for customer ${invoice.customer ?? "unknown"} — keeping Pro during grace`,
            );
            break;
          }
        }
      },
    }),
    // Keep last: lets Better Auth set cookies from Server Actions / RSC.
    nextCookies(),
  ],
});
