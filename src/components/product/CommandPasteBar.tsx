"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Link2, Sparkles } from "lucide-react";
import {
  cn,
  formatPrice,
  looksLikeUrl,
  prettyDomain,
  toPositiveNumber,
} from "@/lib/utils";
import { simulateParse, type ParsePreview } from "@/lib/parse-preview";
import { mockCollections } from "@/lib/mock-data";
import { parseProductUrl, saveProduct } from "@/lib/actions";
import { useHub } from "@/components/hub/HubProvider";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { WheelSpinner } from "@/components/brand/WheelLoader";
import { ProductTile } from "./ProductTile";
import { StockBadge, ConfidenceMeter } from "./StockBadge";

type Status = "idle" | "parsing" | "saving" | "saved";

interface CommandPasteBarProps {
  variant?: "hero" | "bar";
  autoFocus?: boolean;
  className?: string;
  /** Where to go after a successful save. Defaults to staying put. */
  redirectAfterSave?: string;
  /** Real DB collections for the picker; falls back to mock when absent. */
  collections?: { id: string; name: string }[];
}

export function CommandPasteBar({
  variant = "bar",
  autoFocus = false,
  className,
  redirectAfterSave,
  collections,
}: CommandPasteBarProps) {
  const collectionOptions =
    collections && collections.length ? collections : mockCollections;
  const router = useRouter();
  const hub = useHub();
  const inputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [value, setValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsePreview | null>(null);

  // Save options
  const [collectionId, setCollectionId] = useState(collectionOptions[0].id);
  const [watch, setWatch] = useState(true);
  const [target, setTarget] = useState("");

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!looksLikeUrl(value)) {
      setError("That doesn't look like a product link yet.");
      return;
    }
    setError(null);
    setStatus("parsing");
    try {
      setPreview(await parseProductUrl(value));
    } catch {
      // Network/edge failure — fall back to the URL heuristic so the user can
      // still review and save (and edit) the product.
      setPreview(simulateParse(value));
    }
    setStatus("idle");
  }

  function reset() {
    setPreview(null);
    setStatus("idle");
    setValue("");
    setTarget("");
    setWatch(true);
    setCollectionId(collectionOptions[0].id);
    setError(null);
  }

  async function handleSave() {
    if (!preview) return;
    const opts = {
      collectionId,
      watch,
      targetPrice: toPositiveNumber(target),
    };
    setStatus("saving");

    const res = await saveProduct({
      title: preview.title,
      description: preview.description,
      originalUrl: preview.originalUrl,
      canonicalUrl: preview.canonicalUrl,
      imageUrl: preview.imageUrl,
      storeName: preview.storeName,
      storeDomain: preview.storeDomain,
      brand: preview.brand,
      sku: preview.sku,
      category: preview.category,
      currency: preview.currency,
      price: preview.price,
      availability: preview.availability,
      confidence: preview.confidence,
      rawMetadata: preview.rawMetadata,
      ...opts,
    });

    if (!res.ok) {
      if (res.reason === "no-database") {
        // No database (e.g. preview deploy): fall back to the session store so
        // the demo still "saves" within the visit.
        hub?.add(preview, opts);
      } else {
        // Real failure — keep the sheet open and surface the error.
        setStatus("idle");
        setError(res.message ?? "We couldn't save that. Please try again.");
        return;
      }
    }

    setStatus("saved");
    later(() => {
      reset();
      if (redirectAfterSave) router.push(redirectAfterSave);
      else router.refresh();
    }, 1500);
  }

  const isHero = variant === "hero";
  const parsingDomain = value ? prettyDomain(value) : "the page";
  // The free-plan cap was reached on save — offer a calm path to upgrade.
  const limitHit = Boolean(error && error.includes("Free plan is limited"));

  return (
    <div className={cn("w-full", className)}>
      {status === "parsing" ? (
        <div
          className={cn(
            "flex items-center justify-center rounded-full border border-line bg-white shadow-soft",
            isHero ? "h-16 px-6" : "h-12 px-5",
          )}
        >
          <div className="flex items-center gap-3 text-slate">
            <WheelSpinner size={isHero ? 24 : 18} className="text-accent" />
            <span className={cn(isHero ? "text-base" : "text-sm")}>
              Reading {parsingDomain}…
            </span>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full">
          <div
            className={cn(
              "group flex items-center gap-2 rounded-full border bg-white shadow-soft transition-all",
              error
                ? "border-up/50 ring-4 ring-up/10"
                : "border-line focus-within:border-accent/60 focus-within:ring-4 focus-within:ring-accent/10",
              isHero ? "h-16 pl-6 pr-2" : "h-12 pl-4 pr-1.5",
            )}
          >
            <Link2
              size={isHero ? 22 : 18}
              className="shrink-0 text-silver"
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              autoFocus={autoFocus}
              id="unikart-paste"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError(null);
              }}
              inputMode="url"
              placeholder="Paste a product link"
              aria-label="Paste a product link"
              className={cn(
                "min-w-0 flex-1 bg-transparent text-ink placeholder:text-silver focus:outline-none",
                isHero ? "text-lg" : "text-sm",
              )}
            />
            <Button
              type="submit"
              size="md"
              className="shrink-0"
              disabled={!value}
            >
              <span>Save</span>
              <ArrowRight size={isHero ? 18 : 16} />
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p className="mt-2 pl-4 text-xs text-up animate-fade">{error}</p>
      )}
      {isHero && !error && (
        <p className="mt-3 text-center text-sm text-slate">
          Works with most online stores. We never ask for store logins.
        </p>
      )}

      {/* Parse preview / save sheet */}
      <Modal
        open={Boolean(preview)}
        onClose={() => status !== "saving" && reset()}
        hideClose={status === "saved"}
        title={status === "saved" ? undefined : "Save to UniKart"}
        description={
          status === "saved"
            ? undefined
            : "Confirm the details, choose a collection, and set an alert."
        }
      >
        {preview && status === "saved" ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-down-soft text-down">
              <Check size={30} strokeWidth={2.5} />
            </div>
            <h3 className="text-lg font-semibold text-ink">Saved to your Hub</h3>
            <p className="mt-1.5 max-w-xs text-sm text-slate">
              {preview.title} is now being watched. We&apos;ll track price and
              stock for you.
            </p>
          </div>
        ) : preview ? (
          <div className="space-y-5 px-6 pb-6 pt-5">
            {/* Preview card */}
            <div className="flex gap-4 rounded-2xl border border-line bg-white/60 p-3">
              <ProductTile
                category={preview.category}
                imageUrl={preview.imageUrl}
                title={preview.title}
                className="h-24 w-24 shrink-0 rounded-xl"
                iconSize={32}
                watermark={false}
              />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold text-ink">
                  {preview.title}
                </p>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate">
                  <span className="truncate">{preview.storeDomain}</span>
                  <ConfidenceMeter confidence={preview.confidence} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-base font-semibold text-ink">
                    {formatPrice(preview.price, preview.currency)}
                  </span>
                  <StockBadge availability={preview.availability} />
                </div>
              </div>
            </div>

            {/* Collection */}
            <Field label="Collection">
              <div className="relative">
                <select
                  value={collectionId}
                  onChange={(e) => setCollectionId(e.target.value)}
                  className="h-11 w-full appearance-none rounded-xl border border-line bg-white px-4 pr-9 text-sm text-ink shadow-soft focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/10"
                >
                  {collectionOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <ArrowRight
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-silver"
                />
              </div>
            </Field>

            {/* Alert */}
            <Field label="Price alert">
              <button
                type="button"
                onClick={() => setWatch((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-4 py-3 text-left shadow-soft transition-colors hover:bg-canvas"
              >
                <span className="text-sm text-ink">
                  Watch for price drops & stock
                </span>
                <Switch on={watch} />
              </button>
              {watch && (
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-line bg-white px-4 shadow-soft">
                  <span className="text-sm text-slate">Target</span>
                  <input
                    value={target}
                    onChange={(e) =>
                      setTarget(e.target.value.replace(/[^0-9.]/g, ""))
                    }
                    inputMode="decimal"
                    placeholder={
                      preview.price
                        ? `Optional · e.g. ${Math.floor(preview.price * 0.9)}`
                        : "Optional target price"
                    }
                    className="h-11 flex-1 bg-transparent text-sm text-ink placeholder:text-silver focus:outline-none"
                  />
                </div>
              )}
            </Field>

            {error &&
              (limitHit ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-accent-soft px-3 py-2 text-xs text-accent-ink">
                  <span>{error}</span>
                  <Link
                    href="/settings"
                    className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
                  >
                    <Sparkles size={13} /> Upgrade to Coast
                  </Link>
                </div>
              ) : (
                <p className="text-xs text-up">{error}</p>
              ))}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={reset}
                type="button"
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                loading={status === "saving"}
                type="button"
              >
                {status === "saving" ? "Saving…" : "Save product"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-slate">
        {label}
      </label>
      {children}
    </div>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "relative inline-flex h-6 w-10 items-center rounded-full transition-colors",
        on ? "bg-accent" : "bg-fog",
      )}
    >
      <span
        className={cn(
          "absolute h-5 w-5 rounded-full bg-white shadow-soft transition-transform",
          on ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </span>
  );
}
