import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Whether a database is configured. When false, the data layer falls back to
 * read-only mock data so the app still renders (e.g. on a preview deploy with
 * no DATABASE_URL).
 */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
