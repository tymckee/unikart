"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { useOpsToast } from "@/components/ops/OpsToast";
import type { OpsActionResult } from "@/lib/ops/types";

/* Local copies of the option lists — components stay independent of the data
   module's runtime exports (the labels here are the user-facing copy). */
const CATEGORIES: { value: string; label: string }[] = [
  { value: "account", label: "Account" },
  { value: "product_saving", label: "Saving items" },
  { value: "parser_failure", label: "Parser failure" },
  { value: "price_tracking", label: "Price tracking" },
  { value: "stock_tracking", label: "Stock tracking" },
  { value: "billing", label: "Billing" },
  { value: "privacy", label: "Privacy" },
  { value: "bug", label: "Bug" },
  { value: "feedback", label: "Feedback" },
  { value: "other", label: "Other" },
];

const PRIORITIES: { value: string; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

const selectClass =
  "h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none transition-colors focus:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const inputClass =
  "h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-silver focus:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function NewTicketButton({
  createTicket,
}: {
  createTicket: (input: {
    email: string;
    subject: string;
    category: string;
    priority: string;
    userId?: string;
  }) => Promise<OpsActionResult<{ id: string }>>;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("other");
  const [priority, setPriority] = useState("normal");
  const [userId, setUserId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useOpsToast();
  const router = useRouter();

  function reset() {
    setEmail("");
    setSubject("");
    setCategory("other");
    setPriority("normal");
    setUserId("");
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createTicket({
          email: email.trim(),
          subject: subject.trim(),
          category,
          priority,
          userId: userId.trim() || undefined,
        });
        if (result.ok) {
          toast.success(result.message ?? "Ticket opened.");
          setOpen(false);
          reset();
          if (result.data?.id) {
            router.push("/ops/support/" + result.data.id);
          } else {
            router.refresh();
          }
        } else {
          setError(result.message ?? "That didn't work. Please try again.");
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Plus size={16} /> New ticket
      </Button>

      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="New ticket"
        description="Log a ticket from an email or a call. The customer is not notified — email replies are manual for now."
      >
        <div className="space-y-4 px-6 pb-6 pt-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate">
              Customer email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Short summary of the issue"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={selectClass}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={selectClass}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate">
              Link to user id <span className="text-silver">(optional)</span>
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Paste a user id to link, or leave blank"
              className={inputClass + " font-mono text-[0.8125rem]"}
            />
            <p className="mt-1 text-xs text-silver">
              Find ids in the Users area. You can also link a user later.
            </p>
          </div>

          {error && <p className="text-sm text-up">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={pending}>
              Open ticket
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
