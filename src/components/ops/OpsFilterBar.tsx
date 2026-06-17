"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OpsFilterSelect {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * URL-driven filter bar. Search + dropdown filters write to the query string
 * (server reads them and re-queries) — so filtering is server-side and never
 * loads all rows into the browser. Changing any filter resets to page 1.
 */
export function OpsFilterBar({
  searchKey = "q",
  searchPlaceholder = "Search…",
  filters = [],
  className,
}: {
  searchKey?: string;
  searchPlaceholder?: string;
  filters?: OpsFilterSelect[];
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get(searchKey) ?? "");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function apply(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page"); // any filter change → back to page 1
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    });
  }

  function onSearchChange(value: string) {
    setQuery(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => apply({ [searchKey]: value }), 350);
  }

  const activeCount =
    (params.get(searchKey) ? 1 : 0) +
    filters.filter((f) => params.get(f.key)).length;

  return (
    <div className={cn("mb-4 flex flex-wrap items-center gap-2", className)}>
      <div className="relative min-w-[14rem] flex-1">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-silver"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-10 w-full rounded-full border border-line bg-white pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-silver focus:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </div>

      {filters.map((f) => (
        <select
          key={f.key}
          value={params.get(f.key) ?? ""}
          onChange={(e) => apply({ [f.key]: e.target.value })}
          aria-label={f.label}
          className="h-10 rounded-full border border-line bg-white px-3.5 text-sm text-ink outline-none transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <option value="">{f.label}: all</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}

      {activeCount > 0 && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            const cleared: Record<string, null> = { [searchKey]: null };
            for (const f of filters) cleared[f.key] = null;
            apply(cleared);
          }}
          className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm text-slate transition-colors hover:bg-canvas hover:text-ink"
        >
          <X size={14} /> Clear
        </button>
      )}
    </div>
  );
}
