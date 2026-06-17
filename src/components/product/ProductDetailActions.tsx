"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  Check,
  CheckCircle2,
  ExternalLink,
  ShoppingBag,
  Sprout,
  Undo2,
  Wind,
} from "lucide-react";
import { durationSince, formatPrice, toPositiveNumber } from "@/lib/utils";
import type { ProductView } from "@/lib/types";
import {
  addToCart,
  archiveProduct,
  markPurchased,
  releaseProduct,
  removeProductFromCart,
  setAlert,
  unreleaseProduct,
  updateNotes,
} from "@/lib/actions";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Input";

/**
 * Interactive controls on the product detail page, wired to server actions.
 * Local state is optimistic; the server is the source of truth on refresh.
 */
export function ProductDetailActions({ product }: { product: ProductView }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [inCart, setInCart] = useState(product.inCart);
  const [watching, setWatching] = useState(Boolean(product.alert?.enabled));
  const [target, setTarget] = useState(
    product.alert?.targetPrice ? String(product.alert.targetPrice) : "",
  );
  const [notes, setNotes] = useState(product.notes ?? "");
  const [purchased, setPurchased] = useState(product.isPurchased);
  const [notesSaved, setNotesSaved] = useState(false);
  const [released, setReleased] = useState(Boolean(product.releasedAt));

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  const saveAlert = (enabled: boolean) =>
    run(() =>
      setAlert(product.id, {
        enabled,
        targetPrice: toPositiveNumber(target),
      }),
    );

  return (
    <div className="space-y-5">
      {/* Primary actions */}
      <GlassCard variant="solid" className="space-y-2.5 p-5">
        <Button
          className="w-full"
          variant={inCart ? "secondary" : "primary"}
          onClick={() => {
            const next = !inCart;
            setInCart(next);
            run(() =>
              next ? addToCart(product.id) : removeProductFromCart(product.id),
            );
          }}
        >
          {inCart ? <Check size={17} /> : <ShoppingBag size={17} />}
          {inCart ? "In your Universal Cart" : "Add to Universal Cart"}
        </Button>
        <Button
          className="w-full"
          variant="secondary"
          href={product.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open product page <ExternalLink size={15} />
        </Button>
        <div className="flex gap-2.5 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            disabled={purchased}
            onClick={() => {
              setPurchased(true);
              setInCart(false);
              run(() => markPurchased(product.id));
            }}
          >
            <CheckCircle2 size={15} />
            {purchased ? "Purchased" : "Mark purchased"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            onClick={() =>
              startTransition(async () => {
                await archiveProduct(product.id);
                router.push("/dashboard");
              })
            }
          >
            <Archive size={15} />
            Archive
          </Button>
        </div>
      </GlassCard>

      {/* Release — a calm, guilt-free "let it go" */}
      <ReleaseCard
        product={product}
        released={released}
        onRelease={() => {
          setReleased(true);
          setInCart(false);
          run(() => releaseProduct(product.id));
        }}
        onUnrelease={() => {
          setReleased(false);
          run(() => unreleaseProduct(product.id));
        }}
      />

      {/* Target alert */}
      <GlassCard variant="solid" className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">Price alert</h3>
            <p className="mt-0.5 text-xs text-slate">
              Get notified on drops & restocks.
            </p>
          </div>
          <Switch
            checked={watching}
            onCheckedChange={(v) => {
              setWatching(v);
              saveAlert(v);
            }}
            label="Toggle price alert"
          />
        </div>
        {watching && (
          <div className="mt-4 space-y-2">
            <label className="text-xs font-medium text-slate">
              Target price
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 shadow-soft">
              <span className="text-sm text-slate">$</span>
              <input
                value={target}
                onChange={(e) =>
                  setTarget(e.target.value.replace(/[^0-9.]/g, ""))
                }
                onBlur={() => saveAlert(true)}
                inputMode="decimal"
                placeholder={
                  product.currentPrice
                    ? String(Math.floor(product.currentPrice * 0.9))
                    : "0"
                }
                className="h-11 flex-1 bg-transparent text-sm text-ink placeholder:text-silver focus:outline-none"
              />
            </div>
            {target && product.currentPrice != null && (
              <p className="text-xs text-slate">
                We&apos;ll alert you when it reaches{" "}
                <span className="font-medium text-ink">
                  {formatPrice(Number(target), product.currency)}
                </span>{" "}
                — that&apos;s{" "}
                {formatPrice(
                  Math.max(0, product.currentPrice - Number(target)),
                  product.currency,
                )}{" "}
                below today.
              </p>
            )}
          </div>
        )}
      </GlassCard>

      {/* Notes */}
      <GlassCard variant="solid" className="p-5">
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Notes</h3>
          {notesSaved && (
            <span className="inline-flex items-center gap-1 text-xs text-down">
              <Check size={13} /> Saved
            </span>
          )}
        </div>
        <Textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotesSaved(false);
          }}
          onBlur={() =>
            run(async () => {
              await updateNotes(product.id, notes);
              setNotesSaved(true);
            })
          }
          rows={3}
          placeholder="Size, color, who it's for, why you're waiting…"
        />
      </GlassCard>
    </div>
  );
}

/**
 * The Release control. Releasing is a positive, conscious act — letting go of
 * the urge to buy something you've been considering, with no guilt. It's
 * distinct from Archive (filing away) and Delete (erasing): we keep the item
 * and honor how long you thought about it. The released state is intentionally
 * serene rather than transactional.
 */
function ReleaseCard({
  product,
  released,
  onRelease,
  onUnrelease,
}: {
  product: ProductView;
  released: boolean;
  onRelease: () => void;
  onUnrelease: () => void;
}) {
  // How long it was considered: createdAt → releasedAt. Derived purely from the
  // persisted timestamp. In the brief optimistic window right after release
  // (before the server stamps releasedAt and router.refresh lands) we simply
  // omit the duration rather than read an impure clock during render.
  const consideredFor = product.releasedAt
    ? durationSince(product.createdAt, product.releasedAt)
    : null;

  return (
    <GlassCard variant="solid" className="overflow-hidden p-5">
      <AnimatePresence mode="wait" initial={false}>
        {released ? (
          <motion.div
            key="released"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-3 text-center"
          >
            <span className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-canvas text-slate">
              <Wind size={20} />
            </span>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-ink">Released</h3>
              <p className="text-xs leading-relaxed text-slate">
                {consideredFor
                  ? `You let this go after considering it for ${consideredFor}.`
                  : "You let this go."}{" "}
                No guilt — that&apos;s money and attention back in your pocket.
              </p>
            </div>
            <button
              type="button"
              onClick={onUnrelease}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate transition-colors hover:text-ink"
            >
              <Undo2 size={13} />
              Bring it back
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="release"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas text-slate">
                <Sprout size={17} />
              </span>
              <div>
                <h3 className="text-sm font-semibold text-ink">Let it go</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-slate">
                  Decided you don&apos;t need this after all? Release it — a calm
                  way to step back from the urge to buy, with nothing lost.
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={onRelease}
            >
              <Wind size={15} />
              Release
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}
