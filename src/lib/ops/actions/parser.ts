"use server";

/**
 * UniKart Ops — Parser server actions.
 *
 * Every mutation here (1) gates via requireOpsPermission, (2) writes an audit
 * row, (3) revalidates the page, and (4) returns a typed OpsActionResult.
 *
 * Honesty note: a real reparse/scrape pipeline is not wired up in v1, so
 * `retryParse` records the intent (an audit row + a queued JobRun) and returns
 * an honest "queued" message rather than faking a parse result. We never bypass
 * anti-bot protections, never scrape aggressively, and never store cookies or
 * credentials — parsing reads public product metadata only.
 */
import { revalidatePath } from "next/cache";
import { prisma, hasDatabase } from "@/lib/db";
import { requireOpsPermission } from "@/lib/ops/guard";
import { recordAdminAudit } from "@/lib/ops/audit";
import { recordJobRun } from "@/lib/ops/jobs";
import { prettyDomain } from "@/lib/utils";
import type { OpsActionResult } from "@/lib/ops/types";

const WATCHLIST_SETTING_KEY = "parser.watchlistedDomains";

/** Read the current watchlist array from its SystemSetting (safe on parse error). */
async function readWatchlist(): Promise<string[]> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key: WATCHLIST_SETTING_KEY },
    select: { valueJson: true },
  });
  if (!setting?.valueJson) return [];
  try {
    const parsed = JSON.parse(setting.valueJson);
    return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Queue a re-parse for a single attempt (by id) or an arbitrary URL. We record
 * the intent and a queued parser JobRun; the actual parse runs out-of-band.
 */
export async function retryParse(attemptIdOrUrl: string): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("parser.retry");
  if (!gate.ok) return gate;
  // requireOpsPermission's success branch carries the viewer; the union with
  // OpsActionResult<never> means TS can't auto-narrow, so capture it explicitly.
  const viewer = ("viewer" in gate ? gate.viewer : null)!;

  const raw = attemptIdOrUrl.trim();
  if (!raw) return { ok: false, reason: "invalid", message: "Provide a parse attempt or URL." };

  try {
    // Resolve a URL + domain for the audit/job metadata. If the input looks
    // like a URL, use it directly; otherwise treat it as an attempt id.
    let url: string | null = null;
    let domain: string | null = null;
    let attemptId: string | null = null;

    if (raw.includes("://") || raw.includes(".")) {
      // Looks like a URL (or bare domain).
      url = raw;
      domain = prettyDomain(raw);
    }

    if (!url) {
      const attempt = await prisma.parseAttempt.findUnique({
        where: { id: raw },
        select: { url: true, domain: true },
      });
      if (!attempt) return { ok: false, reason: "not-found", message: "Parse attempt not found." };
      attemptId = raw;
      url = attempt.url;
      domain = attempt.domain;
    }

    const jobRunId = await recordJobRun({
      jobType: "parser",
      status: "queued",
      createdBy: viewer.id,
      metadata: { url, domain, source: "ops_manual_retry", attemptId },
    });

    await recordAdminAudit({
      actor: viewer,
      action: "parser.retry",
      targetType: "parse_attempt",
      targetId: attemptId ?? domain,
      reason: null,
      metadata: { url, domain, jobRunId },
    });

    revalidatePath("/ops/parser");
    return { ok: true, message: "Parse retry queued." };
  } catch (e) {
    console.error("[ops] retryParse:", e);
    return { ok: false, reason: "error", message: "Couldn't queue the retry. Please try again." };
  }
}

/**
 * Add or remove a domain from the manual review watchlist (a SystemSetting
 * array). Idempotent — toggling on twice keeps a single entry.
 */
export async function watchlistDomain(domain: string, on: boolean): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("parser.mutate");
  if (!gate.ok) return gate;
  const viewer = ("viewer" in gate ? gate.viewer : null)!;

  const normalized = prettyDomain(domain.trim());
  if (!normalized) return { ok: false, reason: "invalid", message: "Provide a domain." };

  try {
    const before = await readWatchlist();
    const set = new Set(before);
    if (on) set.add(normalized);
    else set.delete(normalized);
    const after = [...set].sort();

    await prisma.systemSetting.upsert({
      where: { key: WATCHLIST_SETTING_KEY },
      update: { valueJson: JSON.stringify(after), updatedById: viewer.id },
      create: {
        key: WATCHLIST_SETTING_KEY,
        valueJson: JSON.stringify(after),
        category: "parser",
        description: "Domains flagged for review (manual watchlist).",
        updatedById: viewer.id,
      },
    });

    await recordAdminAudit({
      actor: viewer,
      action: on ? "parser.watchlist.add" : "parser.watchlist.remove",
      targetType: "parser_domain",
      targetId: normalized,
      before: { watchlisted: before.includes(normalized) },
      after: { watchlisted: on },
    });

    revalidatePath("/ops/parser");
    return {
      ok: true,
      message: on ? "Domain added to the watchlist." : "Domain removed from the watchlist.",
    };
  } catch (e) {
    console.error("[ops] watchlistDomain:", e);
    return { ok: false, reason: "error", message: "Couldn't update the watchlist. Please try again." };
  }
}

/**
 * Save (or clear) an internal note for a domain. Stored as a SystemSetting under
 * "parser.note.<domain>". Notes are operator context only — never PII or secrets.
 */
export async function addDomainNote(domain: string, note: string): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("parser.mutate");
  if (!gate.ok) return gate;
  const viewer = ("viewer" in gate ? gate.viewer : null)!;

  const normalized = prettyDomain(domain.trim());
  if (!normalized) return { ok: false, reason: "invalid", message: "Provide a domain." };

  const trimmed = note.trim().slice(0, 1000);
  const key = "parser.note." + normalized;

  try {
    const existing = await prisma.systemSetting.findUnique({
      where: { key },
      select: { valueJson: true },
    });
    let before = "";
    if (existing?.valueJson) {
      try {
        const parsed = JSON.parse(existing.valueJson);
        if (typeof parsed === "string") before = parsed;
      } catch {
        before = "";
      }
    }

    await prisma.systemSetting.upsert({
      where: { key },
      update: { valueJson: JSON.stringify(trimmed), updatedById: viewer.id },
      create: {
        key,
        valueJson: JSON.stringify(trimmed),
        category: "parser",
        description: "Operator note for domain " + normalized + ".",
        updatedById: viewer.id,
      },
    });

    await recordAdminAudit({
      actor: viewer,
      action: "parser.domain_note.set",
      targetType: "parser_domain",
      targetId: normalized,
      before: { hasNote: Boolean(before) },
      after: { hasNote: Boolean(trimmed) },
    });

    revalidatePath("/ops/parser");
    return { ok: true, message: trimmed ? "Note saved." : "Note cleared." };
  } catch (e) {
    console.error("[ops] addDomainNote:", e);
    return { ok: false, reason: "error", message: "Couldn't save the note. Please try again." };
  }
}

/**
 * Placeholder for per-domain extraction rules. The rule engine isn't built in
 * v1, so this records the intent and returns honestly. The UI keeps the entry
 * point visible but disabled.
 */
export async function createDomainRule(domain: string, note?: string): Promise<OpsActionResult> {
  const gate = await requireOpsPermission("parser.mutate");
  if (!gate.ok) return gate;
  const viewer = ("viewer" in gate ? gate.viewer : null)!;

  const normalized = prettyDomain(domain.trim());
  if (!normalized) return { ok: false, reason: "invalid", message: "Provide a domain." };

  try {
    await recordAdminAudit({
      actor: viewer,
      action: "parser.domain_rule.create",
      targetType: "parser_domain",
      targetId: normalized,
      metadata: { note: note?.trim().slice(0, 500) ?? null, status: "v1_placeholder" },
    });

    // Touch the DB to keep the action honest about the no-db case.
    if (!hasDatabase()) {
      return { ok: false, reason: "no-db", message: "Database unavailable." };
    }

    revalidatePath("/ops/parser");
    return {
      ok: true,
      message: "Noted. Domain extraction rules are planned — not editable yet in this version.",
    };
  } catch (e) {
    console.error("[ops] createDomainRule:", e);
    return { ok: false, reason: "error", message: "Couldn't record this. Please try again." };
  }
}
