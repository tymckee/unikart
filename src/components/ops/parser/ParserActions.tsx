"use client";

/**
 * UniKart Ops — Parser action controls (client).
 *
 * Receives the server actions as props from the (server) Parser page — this file
 * never imports prisma or the DB. It renders:
 *   - a per-row kebab menu for a recent attempt (retry / watchlist / note)
 *   - a per-domain kebab menu for a domain health row
 *   - a small "queue a retry" form for an arbitrary URL
 *
 * Mutations route through the shared OpsReasonDialog / a local note dialog so the
 * underlying server actions can audit and revalidate. Hidden items respect the
 * viewer's permissions (the server still re-checks — this only hides UI).
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, Eye, EyeOff, StickyNote, Settings2, Link2 } from "lucide-react";
import { OpsActionMenu } from "@/components/ops/OpsActionMenu";
import { OpsReasonDialog } from "@/components/ops/OpsReasonDialog";
import { useOpsToast } from "@/components/ops/OpsToast";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { OpsActionResult } from "@/lib/ops/types";

export interface ParserActionsProps {
  retryParse: (attemptIdOrUrl: string) => Promise<OpsActionResult>;
  watchlistDomain: (domain: string, on: boolean) => Promise<OpsActionResult>;
  addDomainNote: (domain: string, note: string) => Promise<OpsActionResult>;
  /** Permission flags from the server (UI hiding only). */
  canRetry: boolean;
  canMutate: boolean;
}

/* ---------------------------------------------------------------- *
 * Row-level menu for a recent parse attempt.
 * ---------------------------------------------------------------- */
export function ParseAttemptActions({
  attemptId,
  domain,
  watchlisted,
  retryParse,
  watchlistDomain,
  addDomainNote,
  canRetry,
  canMutate,
}: {
  attemptId: string;
  domain: string;
  watchlisted: boolean;
  retryParse: ParserActionsProps["retryParse"];
  watchlistDomain: ParserActionsProps["watchlistDomain"];
  addDomainNote: ParserActionsProps["addDomainNote"];
  canRetry: boolean;
  canMutate: boolean;
}) {
  const router = useRouter();
  const toast = useOpsToast();
  const [, startTransition] = useTransition();
  const [noteOpen, setNoteOpen] = useState(false);

  function quickRetry() {
    startTransition(async () => {
      const r = await retryParse(attemptId);
      if (r.ok) {
        toast.success(r.message ?? "Parse retry queued.");
        router.refresh();
      } else {
        toast.error(r.message ?? "Couldn't queue the retry.");
      }
    });
  }

  function toggleWatchlist() {
    startTransition(async () => {
      const r = await watchlistDomain(domain, !watchlisted);
      if (r.ok) {
        toast.success(r.message ?? "Watchlist updated.");
        router.refresh();
      } else {
        toast.error(r.message ?? "Couldn't update the watchlist.");
      }
    });
  }

  return (
    <>
      <OpsActionMenu
        items={[
          {
            label: "Queue a parse retry",
            icon: <RefreshCcw size={15} />,
            onSelect: quickRetry,
            hidden: !canRetry,
          },
          {
            label: watchlisted ? "Remove domain from watchlist" : "Add domain to watchlist",
            icon: watchlisted ? <EyeOff size={15} /> : <Eye size={15} />,
            onSelect: toggleWatchlist,
            hidden: !canMutate,
          },
          {
            label: "Add a domain note",
            icon: <StickyNote size={15} />,
            onSelect: () => setNoteOpen(true),
            hidden: !canMutate,
          },
        ]}
      />
      <DomainNoteDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        domain={domain}
        addDomainNote={addDomainNote}
      />
    </>
  );
}

/* ---------------------------------------------------------------- *
 * Row-level menu for a domain health row.
 * ---------------------------------------------------------------- */
export function DomainActions({
  domain,
  watchlisted,
  watchlistDomain,
  addDomainNote,
  canMutate,
}: {
  domain: string;
  watchlisted: boolean;
  watchlistDomain: ParserActionsProps["watchlistDomain"];
  addDomainNote: ParserActionsProps["addDomainNote"];
  canMutate: boolean;
}) {
  const router = useRouter();
  const toast = useOpsToast();
  const [, startTransition] = useTransition();
  const [noteOpen, setNoteOpen] = useState(false);

  function toggleWatchlist() {
    startTransition(async () => {
      const r = await watchlistDomain(domain, !watchlisted);
      if (r.ok) {
        toast.success(r.message ?? "Watchlist updated.");
        router.refresh();
      } else {
        toast.error(r.message ?? "Couldn't update the watchlist.");
      }
    });
  }

  return (
    <>
      <OpsActionMenu
        items={[
          {
            label: watchlisted ? "Remove from watchlist" : "Add to watchlist",
            icon: watchlisted ? <EyeOff size={15} /> : <Eye size={15} />,
            onSelect: toggleWatchlist,
            hidden: !canMutate,
          },
          {
            label: "Add a domain note",
            icon: <StickyNote size={15} />,
            onSelect: () => setNoteOpen(true),
            hidden: !canMutate,
          },
          {
            label: "Domain extraction rule",
            icon: <Settings2 size={15} />,
            onSelect: () => {},
            hidden: !canMutate,
            disabled: true,
          },
        ]}
      />
      <DomainNoteDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        domain={domain}
        addDomainNote={addDomainNote}
      />
    </>
  );
}

/* ---------------------------------------------------------------- *
 * "Queue a retry" for an arbitrary URL (page header action).
 * ---------------------------------------------------------------- */
export function RetryByUrlButton({
  retryParse,
}: {
  retryParse: ParserActionsProps["retryParse"];
}) {
  return (
    <OpsReasonDialog
      title="Queue a parse retry"
      description="Paste a product URL to re-read its public metadata. The parse runs out-of-band; nothing is charged and no login is required."
      confirmLabel="Queue retry"
      reasonLabel="Product URL"
      reasonPlaceholder="https://store.example.com/product/123"
      reasonRequired
      successMessage="Parse retry queued."
      action={(url) => retryParse(url)}
      trigger={(open) => (
        <Button variant="secondary" size="sm" onClick={open}>
          <Link2 size={15} />
          Queue a retry
        </Button>
      )}
    />
  );
}

/* ---------------------------------------------------------------- *
 * Shared domain-note dialog.
 * ---------------------------------------------------------------- */
function DomainNoteDialog({
  open,
  onOpenChange,
  domain,
  addDomainNote,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain: string;
  addDomainNote: ParserActionsProps["addDomainNote"];
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useOpsToast();
  const router = useRouter();

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await addDomainNote(domain, note.trim());
      if (r.ok) {
        toast.success(r.message ?? "Note saved.");
        onOpenChange(false);
        setNote("");
        router.refresh();
      } else {
        setError(r.message ?? "Couldn't save the note.");
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => !pending && onOpenChange(false)}
      title={"Note for " + domain}
      description="Operator context for this domain — kept internal. No customer data or secrets."
    >
      <div className="px-6 pb-6 pt-4">
        <label className="mb-1.5 block text-xs font-medium text-slate">Note</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Switched to a new template; JSON-LD now missing price."
          rows={3}
          className="w-full resize-none rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-silver focus:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
        {error && <p className="mt-3 text-sm text-up">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={pending}>
            Save note
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- *
 * Standalone search box for queueing a retry by URL (inline form).
 * ---------------------------------------------------------------- */
export function RetryUrlForm({
  retryParse,
  canRetry,
}: {
  retryParse: ParserActionsProps["retryParse"];
  canRetry: boolean;
}) {
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const toast = useOpsToast();
  const router = useRouter();

  if (!canRetry) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = url.trim();
    if (!value) return;
    startTransition(async () => {
      const r = await retryParse(value);
      if (r.ok) {
        toast.success(r.message ?? "Parse retry queued.");
        setUrl("");
        router.refresh();
      } else {
        toast.error(r.message ?? "Couldn't queue the retry.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Input
        leading={<Link2 size={15} />}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Paste a product URL to re-read its public metadata"
        className="flex-1"
        aria-label="Product URL to re-parse"
      />
      <Button type="submit" variant="secondary" size="sm" loading={pending}>
        Queue retry
      </Button>
    </form>
  );
}
