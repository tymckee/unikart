"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Brain, Sparkles } from "lucide-react";
import { generateGist } from "@/lib/actions";
import type { ProductGist } from "@/lib/ai/gist";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";

export function ProductGistCard({
  productId,
  initial,
}: {
  productId: string;
  initial: ProductGist | null;
}) {
  const router = useRouter();
  const [gist, setGist] = useState<ProductGist | null>(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const generate = () =>
    startTransition(async () => {
      setError(null);
      const res = await generateGist(productId);
      if (res.ok && res.data) {
        setGist(res.data);
        router.refresh();
      } else if (!res.ok && res.reason === "no-database") {
        setError("Connect a database (DATABASE_URL) to use AI summaries.");
      } else {
        setError("Couldn't generate a summary. Try again.");
      }
    });

  return (
    <GlassCard variant="solid" className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate">
          <Sparkles size={14} className="text-accent" /> The gist
        </div>
        {gist && (
          <Button variant="ghost" size="sm" onClick={generate} loading={pending}>
            Refresh
          </Button>
        )}
      </div>

      {gist ? (
        <>
          <ul className="space-y-1.5">
            {gist.summary.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-ink">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                {s}
              </li>
            ))}
          </ul>
          {gist.specs.length > 0 && (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-line pt-4">
              {gist.specs.map((sp, i) => (
                <div key={i} className="min-w-0">
                  <dt className="text-[0.625rem] uppercase tracking-wide text-silver">
                    {sp.label}
                  </dt>
                  <dd className="truncate text-sm text-ink" title={sp.value}>
                    {sp.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-slate">
            Cut the clutter — let AI pull the key points and specs out of a long,
            noisy listing.
          </p>
          <Button size="sm" onClick={generate} loading={pending}>
            <Brain size={15} /> Simplify with AI
          </Button>
          {error && <p className="text-xs text-up">{error}</p>}
        </div>
      )}
    </GlassCard>
  );
}
