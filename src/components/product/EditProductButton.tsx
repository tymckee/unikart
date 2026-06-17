"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilLine } from "lucide-react";
import { updateProduct } from "@/lib/actions";
import type { Availability, ProductView } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";

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

export function EditProductButton({ product }: { product: ProductView }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState(product.title);
  const [url, setUrl] = useState(product.originalUrl);
  const [price, setPrice] = useState(
    product.currentPrice != null ? String(product.currentPrice) : "",
  );
  const [availability, setAvailability] = useState<Availability>(
    product.availability,
  );
  const [category, setCategory] = useState(product.category ?? "Other");

  function submit() {
    if (!title.trim()) {
      setError("Title can't be empty.");
      return;
    }
    startTransition(async () => {
      const res = await updateProduct(product.id, {
        title: title.trim(),
        originalUrl: url.trim(),
        category: category === "Other" ? null : category,
        currentPrice: price ? Number(price) : null,
        availability,
      });
      if (res.ok) {
        setOpen(false);
        setError(null);
        router.refresh();
      } else if (res.reason === "no-database") {
        setError("Connect a database (DATABASE_URL) to edit products.");
      } else {
        setError(res.message ?? "Couldn't save your changes.");
      }
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <PencilLine size={15} /> Edit
      </Button>

      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Edit product"
        description="Correct anything the parser got wrong."
      >
        <div className="space-y-4 px-6 pb-6 pt-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate">Title</label>
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (error) setError(null);
              }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate">
              Product URL
            </label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate">
                Price (USD)
              </label>
              <Input
                value={price}
                onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate">
                Availability
              </label>
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
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate">
              Category
            </label>
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
          </div>

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
            <Button className="flex-1" onClick={submit} loading={pending} type="button">
              Save changes
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
