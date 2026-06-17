"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilLine } from "lucide-react";
import {
  cn,
  prettyDomain,
  storeNameFromDomain,
} from "@/lib/utils";
import { saveProduct } from "@/lib/actions";
import { mockCollections } from "@/lib/mock-data";
import { useHub } from "@/components/hub/HubProvider";
import type { Availability } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";

const CATEGORIES = [
  "Headphones",
  "Home",
  "Kitchen",
  "Office",
  "Gaming",
  "Apparel",
  "Toys",
  "E-reader",
  "Travel",
  "Footwear",
  "Other",
];

const AVAILABILITY: { value: Availability; label: string }[] = [
  { value: "in_stock", label: "In stock" },
  { value: "low_stock", label: "Low stock" },
  { value: "out_of_stock", label: "Out of stock" },
  { value: "unknown", label: "Unknown" },
];

const selectCls =
  "h-11 w-full rounded-xl border border-line bg-white px-4 text-sm text-ink shadow-soft focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/10";

export function ManualAddButton({
  collections,
}: {
  collections?: { id: string; name: string }[];
} = {}) {
  const router = useRouter();
  const hub = useHub();
  const collectionOptions =
    collections && collections.length ? collections : mockCollections;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Home");
  const [availability, setAvailability] = useState<Availability>("in_stock");
  const [collectionId, setCollectionId] = useState(collectionOptions[0].id);
  const [watch, setWatch] = useState(true);

  // Cmd/Ctrl+N opens manual add
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function reset() {
    setTitle("");
    setUrl("");
    setPrice("");
    setCategory("Home");
    setAvailability("in_stock");
    setCollectionId(collectionOptions[0].id);
    setWatch(true);
    setError(null);
  }

  function submit() {
    if (!title.trim()) {
      setError("A title is required.");
      return;
    }
    const cleanUrl = url.trim() || "https://example.com";
    const storeDomain = prettyDomain(cleanUrl);
    const priceNum = price ? Number(price) : null;

    startTransition(async () => {
      const res = await saveProduct({
        title: title.trim(),
        originalUrl: cleanUrl.includes("://") ? cleanUrl : `https://${cleanUrl}`,
        storeName: storeNameFromDomain(storeDomain),
        storeDomain,
        category: category === "Other" ? null : category,
        currency: "USD",
        price: priceNum,
        availability,
        confidence: "high",
        collectionId,
        watch,
        targetPrice: null,
      });

      if (!res.ok && res.reason === "no-database") {
        // Fallback to session store so it still appears in this visit.
        hub?.add(
          {
            title: title.trim(),
            description: "Added manually.",
            storeName: storeNameFromDomain(storeDomain),
            storeDomain,
            category: category === "Other" ? "Home" : category,
            price: priceNum ?? 0,
            currency: "USD",
            availability,
            confidence: "high",
            originalUrl: cleanUrl,
            canonicalUrl: cleanUrl,
          },
          { collectionId, watch, targetPrice: null },
        );
      } else if (!res.ok) {
        setError(res.message ?? "Couldn't save that product.");
        return;
      }

      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <PencilLine size={15} /> Add manually
      </Button>

      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Add a product manually"
        description="For when a link won't parse — enter the details yourself."
      >
        <div className="space-y-4 px-6 pb-6 pt-4">
          <Field label="Title">
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Sony WH-1000XM5"
              autoFocus
            />
          </Field>
          <Field label="Product URL (optional)">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://store.com/product"
              inputMode="url"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (USD)">
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0.00"
                inputMode="decimal"
              />
            </Field>
            <Field label="Availability">
              <select
                value={availability}
                onChange={(e) => setAvailability(e.target.value as Availability)}
                className={selectCls}
              >
                {AVAILABILITY.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={selectCls}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Collection">
              <select
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                className={selectCls}
              >
                {collectionOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <button
            type="button"
            onClick={() => setWatch((v) => !v)}
            className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-4 py-3 text-left shadow-soft transition-colors hover:bg-canvas"
          >
            <span className="text-sm text-ink">Watch for price drops</span>
            <Switch checked={watch} onCheckedChange={setWatch} />
          </button>

          {error && <p className="text-xs text-up">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setOpen(false)}
              type="button"
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={submit}
              loading={pending}
              type="button"
            >
              Save product
            </Button>
          </div>
        </div>
      </Modal>
    </>
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
    <div className={cn("min-w-0")}>
      <label className="mb-1.5 block text-xs font-medium text-slate">
        {label}
      </label>
      {children}
    </div>
  );
}
