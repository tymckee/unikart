/**
 * UniKart Ops — parser telemetry.
 *
 * `recordParseAttempt()` logs one ParseAttempt per URL parse so the Parser
 * dashboard can show success rate by domain, failure reasons, and which
 * extraction source (JSON-LD / OG / Twitter / ecommerce meta / HTML / manual)
 * produced the result.
 *
 * Best-effort — never throws into the caller. Error messages are truncated and
 * metadata is sanitized; we never store cookies, credentials, or full pages.
 */
import { hasDatabase, prisma } from "../db";
import { safeJson } from "./sanitize";
import { prettyDomain } from "../utils";

export type ParseStatus = "success" | "partial" | "failed";

export type ExtractionMethod =
  | "jsonld"
  | "opengraph"
  | "twitter"
  | "ecommerce_meta"
  | "html_fallback"
  | "manual_fallback";

export interface ParseAttemptInput {
  url: string;
  domain?: string;
  status: ParseStatus;
  confidence?: "high" | "medium" | "low" | null;
  extractionMethod?: ExtractionMethod | (string & {}) | null;
  durationMs?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  productId?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function recordParseAttempt(input: ParseAttemptInput): Promise<void> {
  if (!hasDatabase()) return;
  try {
    await prisma.parseAttempt.create({
      data: {
        url: input.url.slice(0, 2000),
        domain: input.domain ?? prettyDomain(input.url),
        status: input.status,
        confidence: input.confidence ?? null,
        extractionMethod: input.extractionMethod ?? null,
        durationMs: input.durationMs ?? null,
        errorCode: input.errorCode ?? null,
        errorMessage: input.errorMessage?.slice(0, 1000) ?? null,
        productId: input.productId ?? null,
        userId: input.userId ?? null,
        metadataJson: safeJson(input.metadata),
      },
    });
  } catch (e) {
    console.error("[ops] recordParseAttempt failed:", e);
  }
}
