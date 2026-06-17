import { cn } from "@/lib/utils";
import { dateTime, shortId } from "@/lib/ops/format";
import { Pill } from "@/components/ui/Pill";
import type { AuditLogView } from "@/lib/ops/types";

/** Friendly verb styling for common audit actions. */
function actionTone(action: string): "accent" | "up" | "warn" | "neutral" | "down" {
  if (action.includes("denied") || action.includes("delete") || action.includes("disable"))
    return "up";
  if (action.includes("export") || action.includes("role") || action.includes("refund"))
    return "warn";
  if (action.includes("create") || action.includes("enable") || action.includes("resend"))
    return "down";
  return "neutral";
}

/**
 * Compact, read-only audit trail. Used on detail pages (filtered to a target)
 * and on the Audit Log page. Never editable.
 */
export function OpsAuditTrail({
  entries,
  showActor = true,
  emptyText = "No audit activity yet.",
  className,
}: {
  entries: AuditLogView[];
  showActor?: boolean;
  emptyText?: string;
  className?: string;
}) {
  if (entries.length === 0) {
    return <p className={cn("text-sm text-slate", className)}>{emptyText}</p>;
  }
  return (
    <ol className={cn("relative space-y-0", className)}>
      {entries.map((e) => (
        <li
          key={e.id}
          className="flex gap-3 border-b border-line/70 py-3 last:border-0"
        >
          <div className="mt-1 shrink-0">
            <Pill tone={actionTone(e.action)} size="sm">
              {e.action}
            </Pill>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink">
              {showActor && <span className="font-medium">{e.adminEmail}</span>}
              {showActor && " "}
              <span className="text-slate">
                on {e.targetType}
                {e.targetId ? ` ${shortId(e.targetId)}` : ""}
              </span>
            </p>
            {e.reason && <p className="mt-0.5 text-xs text-slate text-pretty">“{e.reason}”</p>}
            <p className="mt-0.5 text-xs text-silver tabular-nums">
              {dateTime(e.createdAt)}
              {e.role ? ` · ${e.role}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
