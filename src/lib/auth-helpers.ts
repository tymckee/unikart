import type { User } from "./types";
import { mockUser } from "./mock-data";

/** Lightweight email validity check for the sign-in form. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/**
 * Auth seam. Phase 1 returns a mock signed-in user so the UI can be
 * built without real auth. Swap this for Auth.js (NextAuth v5)
 * `auth()` in a later phase — call sites only depend on this function.
 */
export async function getCurrentUser(): Promise<User> {
  return mockUser;
}
