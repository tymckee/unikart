"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createCollection } from "@/lib/actions";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";

const ICONS = [
  "cpu",
  "home",
  "lamp",
  "shirt",
  "gift",
  "briefcase",
  "plane",
  "clock",
];

export function NewCollectionButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("cpu");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!name.trim()) {
      setError("Give your collection a name.");
      return;
    }
    startTransition(async () => {
      const res = await createCollection(name.trim(), icon);
      if (res.ok) {
        setOpen(false);
        setName("");
        setIcon("cpu");
        setError(null);
        router.refresh();
      } else if (res.reason === "no-database") {
        setError("Connect a database (DATABASE_URL) to save collections.");
      } else {
        setError(res.message ?? "Couldn't create that collection.");
      }
    });
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <Plus size={15} /> New collection
      </Button>

      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="New collection"
        description="A collection to group products you save."
      >
        <div className="space-y-4 px-6 pb-6 pt-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Apartment"
              autoFocus
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate">
              Icon
            </label>
            <select
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-white px-4 text-sm capitalize text-ink shadow-soft focus:border-accent/60 focus:outline-none focus:ring-4 focus:ring-accent/10"
            >
              {ICONS.map((i) => (
                <option key={i} value={i}>
                  {i}
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
            <Button
              className="flex-1"
              onClick={submit}
              loading={pending}
              type="button"
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
