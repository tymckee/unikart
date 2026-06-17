"use client";

/**
 * UniKart Ops — Products detail action panel (client).
 *
 * Receives the bound server actions as props from the server page (data fetching
 * and authorization stay on the server; this just drives the dialogs). Each
 * destructive / on-behalf action is gated behind a reason dialog; permission-
 * gated visibility is decided on the server and passed in via `can`.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Gauge,
  Flag,
  Store,
  PauseCircle,
  Archive,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { OpsConfirmDialog } from "@/components/ops/OpsConfirmDialog";
import { OpsReasonDialog } from "@/components/ops/OpsReasonDialog";
import { useOpsToast } from "@/components/ops/OpsToast";
import type { OpsActionResult } from "@/lib/ops/types";

export interface ProductActionsCan {
  reparse: boolean;
  mutate: boolean;
}

export interface ProductActionsProps {
  productId: string;
  storeName: string;
  storeDomain: string;
  can: ProductActionsCan;
  reparseProduct: (productId: string) => Promise<OpsActionResult>;
  runCheckNow: (productId: string) => Promise<OpsActionResult>;
  markNeedsReview: (productId: string, reason: string) => Promise<OpsActionResult>;
  updateStoreNormalization: (
    productId: string,
    storeName: string,
    storeDomain: string,
  ) => Promise<OpsActionResult>;
  disableTracking: (productId: string, reason: string) => Promise<OpsActionResult>;
  archiveForUser: (productId: string, reason: string) => Promise<OpsActionResult>;
  addProductNote: (productId: string, body: string) => Promise<OpsActionResult>;
}

const menuItemCls =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-[0.8125rem] font-medium text-ink shadow-soft transition-colors hover:border-line-strong hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const dangerItemCls =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-white px-3.5 text-[0.8125rem] font-medium text-up shadow-soft transition-colors hover:bg-up-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function ProductActions(props: ProductActionsProps) {
  const { productId, can } = props;
  const router = useRouter();
  const toast = useOpsToast();

  const [storeOpen, setStoreOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  if (!can.reparse && !can.mutate) {
    return (
      <p className="text-sm text-slate">
        Your role can view this product but not act on it.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {can.reparse && (
        <OpsConfirmDialog
          title="Queue a reparse"
          description="Re-read this product's source page. Queued for the parser — the result appears once it runs."
          confirmLabel="Queue reparse"
          successMessage="Reparse queued."
          action={() => props.reparseProduct(productId)}
          trigger={(open) => (
            <Button variant="secondary" size="sm" onClick={open}>
              <RefreshCw size={15} /> Reparse
            </Button>
          )}
        />
      )}

      {can.mutate && (
        <OpsConfirmDialog
          title="Queue a price and stock check"
          description="Ask the checker to re-read price and availability. Queued — the value updates once it runs."
          confirmLabel="Queue check"
          successMessage="Check queued."
          action={() => props.runCheckNow(productId)}
          trigger={(open) => (
            <Button variant="secondary" size="sm" onClick={open}>
              <Gauge size={15} /> Check now
            </Button>
          )}
        />
      )}

      {can.mutate && (
        <>
          <button type="button" className={menuItemCls} onClick={() => setNoteOpen(true)}>
            <StickyNote size={15} /> Add note
          </button>

          <button type="button" className={menuItemCls} onClick={() => setStoreOpen(true)}>
            <Store size={15} /> Edit store
          </button>

          <OpsReasonDialog
            title="Flag for review"
            description="Send this product to the parser review queue. The reason is recorded in the audit log."
            confirmLabel="Flag for review"
            successMessage="Flagged for review."
            action={(reason) => props.markNeedsReview(productId, reason)}
            trigger={(open) => (
              <button type="button" className={menuItemCls} onClick={open}>
                <Flag size={15} /> Flag for review
              </button>
            )}
          />

          <OpsReasonDialog
            title="Disable tracking"
            description="Stop price and stock checks for this product. Recorded in the audit log."
            confirmLabel="Disable tracking"
            successMessage="Tracking disable recorded."
            action={(reason) => props.disableTracking(productId, reason)}
            trigger={(open) => (
              <button type="button" className={menuItemCls} onClick={open}>
                <PauseCircle size={15} /> Disable tracking
              </button>
            )}
          />

          <OpsReasonDialog
            title="Archive for customer"
            description="Archive this product on the customer's behalf — for a broken or removed listing. It stays in their archive."
            confirmLabel="Archive product"
            danger
            successMessage="Product archived."
            action={(reason) => props.archiveForUser(productId, reason)}
            trigger={(open) => (
              <button type="button" className={dangerItemCls} onClick={open}>
                <Archive size={15} /> Archive
              </button>
            )}
          />
        </>
      )}

      {/* Store normalization form. */}
      {can.mutate && (
        <StoreNormalizationModal
          open={storeOpen}
          onClose={() => setStoreOpen(false)}
          initialName={props.storeName}
          initialDomain={props.storeDomain}
          onSave={(name, domain) => props.updateStoreNormalization(productId, name, domain)}
          onSaved={() => {
            setStoreOpen(false);
            toast.success("Store updated.");
            router.refresh();
          }}
        />
      )}

      {/* Internal note form. */}
      {can.mutate && (
        <NoteModal
          open={noteOpen}
          onClose={() => setNoteOpen(false)}
          onSave={(body) => props.addProductNote(productId, body)}
          onSaved={() => {
            setNoteOpen(false);
            toast.success("Note added.");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function StoreNormalizationModal({
  open,
  onClose,
  initialName,
  initialDomain,
  onSave,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  initialName: string;
  initialDomain: string;
  onSave: (name: string, domain: string) => Promise<OpsActionResult>;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [domain, setDomain] = useState(initialDomain);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (!name.trim() || !domain.trim()) {
      setError("Store name and domain are both required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await onSave(name.trim(), domain.trim());
      if (result.ok) onSaved();
      else setError(result.message ?? "That didn't work. Please try again.");
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => !pending && onClose()}
      title="Edit store details"
      description="Normalize a mis-parsed merchant. This updates the saved product and is recorded in the audit log."
    >
      <div className="space-y-3 px-6 pb-6 pt-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate">Store name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Store name" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate">Store domain</label>
          <Input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="example.com"
          />
        </div>
        {error && <p className="text-sm text-up">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={pending}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function NoteModal({
  open,
  onClose,
  onSave,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (body: string) => Promise<OpsActionResult>;
  onSaved: () => void;
}) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    if (body.trim().length < 2) {
      setError("Add a short note before saving.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await onSave(body.trim());
      if (result.ok) {
        setBody("");
        onSaved();
      } else {
        setError(result.message ?? "That didn't work. Please try again.");
      }
    });
  }

  return (
    <Modal
      open={open}
      onClose={() => !pending && onClose()}
      title="Add an internal note"
      description="Visible only to the Ops team. Recorded against the customer's account."
    >
      <div className="space-y-3 px-6 pb-6 pt-4">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What did you find? (internal only)"
          rows={4}
        />
        {error && <p className="text-sm text-up">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={pending}>
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
