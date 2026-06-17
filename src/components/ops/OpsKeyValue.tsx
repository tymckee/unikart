import { cn } from "@/lib/utils";

export interface KV {
  label: string;
  value: React.ReactNode;
  /** Marks a field as sensitive so it's visually flagged (still never a secret). */
  sensitive?: boolean;
  mono?: boolean;
}

/** Definition-list style key/value rows for detail panels. */
export function OpsKeyValue({
  items,
  columns = 1,
  className,
}: {
  items: KV[];
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <dl
      className={cn(
        "divide-y divide-line",
        columns === 2 && "sm:grid sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0",
        className,
      )}
    >
      {items.map((item, i) => (
        <div
          key={i}
          className={cn(
            "flex items-baseline justify-between gap-4 py-2.5",
            columns === 2 && "sm:border-b sm:border-line",
          )}
        >
          <dt className="shrink-0 text-xs font-medium text-slate">
            {item.label}
            {item.sensitive && (
              <span className="ml-1.5 rounded bg-warn-soft px-1 py-0.5 text-[0.625rem] font-medium text-warn">
                sensitive
              </span>
            )}
          </dt>
          <dd
            className={cn(
              "min-w-0 truncate text-right text-sm text-ink",
              item.mono && "font-mono text-[0.8125rem]",
            )}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
