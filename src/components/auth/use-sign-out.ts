"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

/**
 * Shared sign-out action. Ends the Better Auth session, then routes home and
 * refreshes so the server re-resolves an empty session (the (app) layout will
 * bounce any stale view to /sign-in). Used by the app-shell avatar menu and the
 * Settings account section so the behavior stays identical.
 */
export function useSignOut(redirectTo = "/") {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    if (pending) return;
    setPending(true);
    try {
      await authClient.signOut();
    } finally {
      router.push(redirectTo);
      router.refresh();
    }
  }

  return { signOut, pending };
}
