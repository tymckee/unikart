import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

/**
 * Client-side Better Auth instance for use in React components
 * ("use client"). Mirrors the server plugins so the typed methods
 * (signIn.magicLink, signIn.passkey, passkey.addPasskey, …) are available.
 *
 * baseURL is omitted so the client targets the same origin it's served from —
 * which is exactly what we want for both local dev and production.
 */
export const authClient = createAuthClient({
  plugins: [magicLinkClient(), passkeyClient()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  // Account & security mutations (derived from the server endpoints).
  updateUser,
  changePassword,
  requestPasswordReset,
  resetPassword,
  listSessions,
  revokeOtherSessions,
  revokeSessions,
  deleteUser,
  sendVerificationEmail,
} = authClient;
