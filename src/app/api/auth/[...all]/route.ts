import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * Better Auth mounts all of its endpoints under /api/auth/* via this single
 * catch-all route handler. No Next middleware is used (keeps the deploy
 * Netlify-friendly); session checks happen in server components / actions.
 */
export const { GET, POST } = toNextJsHandler(auth);
